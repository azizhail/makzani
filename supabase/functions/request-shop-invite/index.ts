import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
}

function page(title: string, message: string) {
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${title}</title><body style="font-family:Arial;padding:40px;line-height:1.8"><h1>${title}</h1><p>${message}</p></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const appUrl = Deno.env.get('APP_URL')!;
  const ownerEmail = Deno.env.get('OWNER_EMAIL')!;
  const resendKey = Deno.env.get('RESEND_API_KEY')!;

  try {
    const url = new URL(request.url);
    const approvalToken = url.searchParams.get('token');

    if (approvalToken) {
      const tokenHash = await hashToken(approvalToken);
      const { data: accessRequest, error: requestError } = await supabase
        .from('shop_access_requests')
        .select('id, name, shop_name, email, status')
        .eq('approval_token_hash', tokenHash)
        .eq('status', 'pending')
        .maybeSingle();
      if (requestError || !accessRequest) return page('رابط غير صالح', 'هذا الرابط منتهي أو تم استخدامه سابقًا.');

      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(accessRequest.email, {
        redirectTo: `${appUrl}/auth/callback`
      });
      if (inviteError) return page('تعذر تنفيذ الدعوة', inviteError.message);

      await supabase.from('shop_access_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', accessRequest.id);
      return page('تمت الموافقة', `تمت الموافقة على ${accessRequest.name} لمتجر ${accessRequest.shop_name}. ستصل دعوة الدخول إلى ${accessRequest.email}.`);
    }

    const payload = await request.json();
    const name = String(payload.name || '').trim();
    const shopName = String(payload.shopName || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    if (!name || !shopName || !email || !email.includes('@')) return json({ ok: false, message: 'أكمل بيانات الطلب.' }, 400);

    const token = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const { error: insertError } = await supabase.from('shop_access_requests').insert({ name, shop_name: shopName, email, approval_token_hash: tokenHash });
    if (insertError) return json({ ok: false, message: 'يوجد طلب مشابه أو تعذر حفظ الطلب.' }, 400);

    const approvalUrl = `${appUrl}/functions/v1/request-shop-invite?token=${encodeURIComponent(token)}`;
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') || 'Makzani <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `طلب انضمام جديد: ${shopName}`,
        html: `<div dir="rtl"><h2>طلب انضمام جديد إلى مخزني</h2><p>الاسم: ${name}</p><p>المتجر: ${shopName}</p><p>البريد: ${email}</p><p><a href="${approvalUrl}" style="display:inline-block;padding:12px 20px;background:#16794b;color:#fff;text-decoration:none;border-radius:6px">الموافقة على الانضمام</a></p></div>`
      })
    });
    if (!emailResponse.ok) return json({ ok: false, message: 'تعذر إرسال الطلب إلى الإدارة.' }, 502);
    return json({ ok: true });
  } catch (_error) {
    return json({ ok: false, message: 'حدث خطأ غير متوقع.' }, 500);
  }
});
