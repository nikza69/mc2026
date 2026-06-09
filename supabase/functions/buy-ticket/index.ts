import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { eventId, userId, ticketType, attendee } = await req.json();

    if (!eventId || !userId || !ticketType || !attendee) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId, userId, ticketType, or attendee' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fullName = String(attendee.fullName || '').trim();
    const studentId = String(attendee.studentId || '').trim();
    const icOrPassport = String(attendee.icOrPassport || '').trim();
    const phoneNumber = String(attendee.phoneNumber || '').trim();
    const studentType = String(attendee.studentType || '').trim();

    if (!fullName) {
      return new Response(
        JSON.stringify({ error: 'Full name is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!icOrPassport) {
      return new Response(
        JSON.stringify({ error: 'IC or passport is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (studentType !== 'xmum_student' && studentType !== 'non_xmum_student') {
      return new Response(
        JSON.stringify({ error: 'Invalid studentType' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (studentType === 'xmum_student' && !studentId) {
      return new Response(
        JSON.stringify({ error: 'Student ID is required for XMUM students' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (ticketType !== 'VIP' && ticketType !== 'Normal') {
      return new Response(
        JSON.stringify({ error: 'Invalid ticketType' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('vip_capacity, normal_capacity')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    const capacity = ticketType === 'VIP'
      ? event.vip_capacity
      : event.normal_capacity;

    const { count: soldCount, error: countError } = await supabaseClient
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('ticket_type', ticketType)
      .in('status', ['active', 'checked_in']);

    if (countError) throw countError;

    if ((soldCount || 0) >= capacity) {
      return new Response(
        JSON.stringify({ error: `${ticketType} tickets are sold out` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ticketData = {
      event_id: eventId,
      owner_user_id: userId,
      ticket_type: ticketType,
      token_id: Math.floor(Math.random() * 2147483647) + 1,
      owner_address: 'supabase-ticket',
      status: 'active',
      qr_nonce: crypto.randomUUID(),
      is_verified: false
    };
    
    const { data: ticket, error } = await supabaseClient
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (error) {
      console.error('Database insertion error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Database insertion failed: ${error.message}`);
    }

    const attendeeData = {
      ticket_id: ticket.id,
      event_id: eventId,
      owner_user_id: userId,
      full_name: fullName,
      student_id: studentId || null,
      ic_or_passport: icOrPassport,
      phone_number: phoneNumber,
      student_type: studentType
    };

    const { error: attendeeError } = await supabaseClient
      .from('ticket_attendees')
      .insert([attendeeData]);

    if (attendeeError) {
      console.error('Attendee insertion error:', attendeeError);

      const { error: rollbackError } = await supabaseClient
        .from('tickets')
        .delete()
        .eq('id', ticket.id);

      if (rollbackError) {
        console.error('Ticket rollback error:', rollbackError);
      }

      throw new Error(`Attendee insertion failed: ${attendeeError.message}`);
    }
    
    console.log('Ticket inserted successfully:', ticket.id);

    return new Response(
      JSON.stringify({ success: true, ticket }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Buy ticket error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
