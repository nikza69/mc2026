import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function createSignature(payload: unknown, secret: string) {
  const message = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const privateKeyBuffer = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    privateKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

    const { qrDataString, staffEventId } = await req.json();

    if (!qrDataString || !staffEventId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid request' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let parsedQrData;
    try {
      parsedQrData = JSON.parse(qrDataString);
      if (parsedQrData.qrData) {
        parsedQrData = JSON.parse(parsedQrData.qrData);
      }
    } catch (_error) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid QR code format' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { payload, signature } = parsedQrData;

    if (!payload || !signature) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid QR code data' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { ticket_id, event_id, nonce } = payload;

    if (!ticket_id || !event_id || !nonce) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid QR code payload' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const SIGNER_PRIVATE_KEY = Deno.env.get('SIGNER_PRIVATE_KEY');
    if (!SIGNER_PRIVATE_KEY) {
      throw new Error('SIGNER_PRIVATE_KEY not configured');
    }

    const expectedSignature = await createSignature(payload, SIGNER_PRIVATE_KEY);

    if (signature !== expectedSignature) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid signature - Ticket is forged' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (event_id !== staffEventId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Ticket is for a different event' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: ticket, error } = await supabaseClient
      .from('tickets')
      .select('*, events!inner(id, title)')
      .eq('id', ticket_id)
      .eq('event_id', event_id)
      .eq('qr_nonce', nonce)
      .maybeSingle();

    if (error) throw error;

    if (!ticket) {
      return new Response(
        JSON.stringify({ success: false, message: 'Ticket not found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (ticket.status === 'checked_in') {
      return new Response(
        JSON.stringify({ success: false, message: 'Ticket already checked in' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (ticket.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, message: 'Ticket has been cancelled' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (ticket.status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, message: `Ticket is not active (${ticket.status})` }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: updateError } = await supabaseClient
      .from('tickets')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .eq('status', 'active');

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: `Valid ticket for ${ticket.events.title}` }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Verification error: ' + error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
