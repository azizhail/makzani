const supabaseUrl = window.MAKHZANI_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = window.MAKHZANI_SUPABASE_ANON_KEY || 'your-anon-key';

const supabaseClient = window.supabase && !supabaseUrl.includes('your-project')
  && !supabaseAnonKey.includes('your-anon')
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

window.makhzaniSupabase = supabaseClient;
window.MAKHZANI_SUPABASE_READY = Boolean(supabaseClient);

window.requestShopInvite = async function requestShopInvite(payload) {
  if (!supabaseClient) return { ok: false, message: 'تعذر الاتصال بخدمة الطلبات.' };
  const { data, error } = await supabaseClient.functions.invoke('request-shop-invite', { body: payload });
  if (error) return { ok: false, message: 'تعذر إرسال الطلب حاليًا.' };
  return data || { ok: false, message: 'تعذر إرسال الطلب حاليًا.' };
};

async function getCurrentShopId() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from('shop_members')
    .select('shop_id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.shop_id || null;
}

async function loadShopData() {
  if (!supabaseClient) {
    return { products: [], sales: [], purchases: [], expenses: [], cash_flow: [], customers: [], suppliers: [] };
  }

  const shopId = await getCurrentShopId();
  if (!shopId) {
    return { products: [], sales: [], purchases: [], expenses: [], cash_flow: [], customers: [], suppliers: [] };
  }

  const [productsRes, salesRes, purchasesRes, expensesRes, cashFlowRes, customersRes, suppliersRes] = await Promise.all([
    supabaseClient.from('products').select('*').eq('shop_id', shopId),
    supabaseClient.from('sales').select('*').eq('shop_id', shopId),
    supabaseClient.from('purchases').select('*').eq('shop_id', shopId),
    supabaseClient.from('expenses').select('*').eq('shop_id', shopId),
    supabaseClient.from('cash_flow').select('*').eq('shop_id', shopId),
    supabaseClient.from('customers').select('*').eq('shop_id', shopId),
    supabaseClient.from('suppliers').select('*').eq('shop_id', shopId)
  ]);

  return {
    products: productsRes.data || [],
    sales: salesRes.data || [],
    purchases: purchasesRes.data || [],
    expenses: expensesRes.data || [],
    cash_flow: cashFlowRes.data || [],
    customers: customersRes.data || [],
    suppliers: suppliersRes.data || []
  };
}

async function upsertShopData(tableName, rows, shopId) {
  if (!supabaseClient || !shopId || !rows.length) return;
  const safeRows = rows.map(row => ({ ...row, shop_id: shopId }));
  const { error } = await supabaseClient.from(tableName).upsert(safeRows, { onConflict: 'id' });
  if (error) console.error(`Supabase upsert failed for ${tableName}:`, error);
}