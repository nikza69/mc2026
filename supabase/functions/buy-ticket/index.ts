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

    const { eventId, userId } = await req.json();

    if (!eventId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId or userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ticketData = {
      event_id: eventId,
      owner_user_id: userId,
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
