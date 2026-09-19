# مخزني | SaaS للنشر والبيع

هذا المشروع هو نسخة محلية من نظام إدارة مبيعات ومخزون، وهو الآن جاهز للانتقال إلى نموذج SaaS متعدد المستأجرين باستخدام Supabase.

## المتطلبات الأساسية

- حساب Supabase جديد
- مشروع PostgreSQL في Supabase
- تفعيل Authentication بواسطة البريد الإلكتروني
- إعداد Row Level Security (RLS)
- استضافة Frontend على Vercel أو Netlify

## الهيكل المطلوب

### 1) حسابات المستخدمين

- كل مستخدم لديه ملف تعريف مستقل في `profiles`
- يخلق المستخدم متجره الخاص داخل `shops`
- يمكن دعوة موظفين آخرين عبر `shop_members`

### 2) قاعدة البيانات

تم تجهيز ملف SQL في `supabase/schema.sql` ليغطي:

- `profiles`
- `shops`
- `shop_members`
- `products`
- `sales`
- `purchases`
- `expenses`
- `cash_flow`
- `customers`
- `suppliers`

يتضمن الملف أيضا:

- إنشاء trigger تلقائي بعد تسجيل المستخدم
- سياسة RLS لكل جدول
- فهرسات مهمة للأداء
- عرض تجميعي `shop_summary`

### 3) الأمان

- كل جدول يحتوي على `shop_id`
- جميع البيانات مقيدة حسب `shop_id`
- لا يمكن للمستخدم الوصول إلا إلى متجره الخاص
- يتم التحقق من الصلاحيات عبر `auth.uid()` و `shop_members`

## الخطوات الفعلية

### الخطوة 1: إنشاء المشروع في Supabase

1. افتح https://supabase.com
2. أنشئ مشروع جديد
3. احفظ:
   - `Project URL`
   - `anon public key`
   - `service_role key` (للاستخدام الخلفي فقط)

### الخطوة 2: تشغيل ملف SQL

1. افتح لوحة `SQL Editor`
2. انسخ محتوى ملف `supabase/schema.sql`
3. نفذ الملف داخل المشروع

### الخطوة 3: تفعيل التسجيل

1. اذهب إلى `Authentication`
2. اختر `Providers`
3. فعّل `Email`
4. حدّد إعدادات `Site URL` و `Redirect URLs`

### الخطوة 4: ربط الواجهة الأمامية

### الخطوة 5: دعوات أصحاب المتاجر

التسجيل العام متوقف. يرسل صاحب المتجر طلب دعوة من التطبيق، ثم تصل رسالة إلى بريد المالك وتحتوي على زر موافقة واحد. بعد الموافقة يرسل Supabase دعوة الدخول إلى بريد صاحب المتجر.

لتشغيل إرسال الطلبات، انشر الدالة `supabase/functions/request-shop-invite/index.ts` كـ Supabase Edge Function واضبط الأسرار التالية في إعدادات الدالة:

- `OWNER_EMAIL=azizhail1212@gmail.com`
- `APP_URL=https://makzani.vercel.app`
- `RESEND_API_KEY` من حساب Resend
- `MAIL_FROM` من نطاق موثق في Resend

لا تضع `RESEND_API_KEY` أو `SUPABASE_SERVICE_ROLE_KEY` في ملفات الواجهة أو GitHub.

1. أضف ملف `supabase/client.js` إلى المشروع
2. استبدل القيم:
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_ANON_KEY`
3. استخدم `supabase.auth.signInWithPassword()` لتسجيل الدخول
4. بعد تسجيل الدخول، قم بتحميل بيانات المتجر الحالي فقط

### الخطوة 5: الانتقال من localStorage إلى Supabase

استبدل منطق الحفظ الحالي في `app.js`:

- `localStorage.getItem(...)` → `supabase.from('products').select('*')`
- `localStorage.setItem(...)` → `supabase.from('products').upsert(...)`
- كل عملية تكتب يجب أن تتضمن `shop_id` الخاص بالمستخدم الحالي

### الخطوة 6: النشر

- استضافة الواجهة على Vercel أو Netlify
- إعداد متغيرات البيئة إن لزم الأمر
- التحقق من أن كل متجر يحصل على بياناته فقط

## الخطة العملية للتنفيذ

1. إنشاء حساب Supabase ومنشأة المشروع
2. تنفيذ ملف `schema.sql`
3. اختبار تسجيل دخول مستخدم جديد
4. إنشاء متجر واحد وتعيين مالك له
5. نقل البيانات من `localStorage` إلى `products`, `sales`, `purchases`...
6. اختبار ربط المستخدمين المتعددين لكل متجر
7. النشر إلى الإنتاج
8. إضافة خطط اشتراك وتجهيز Billing لاحقاً

## نقطة مهمة

الحل الحالي باستخدام `localStorage` لا يصلح للبيع التجاري لأنه:

- لا يوجد تخزين موثوق عبر الأجهزة
- لا توجد قاعدة بيانات مركزية
- لا توجد عزل بين المتاجر
- لا توجد حماية كاملة للبيانات

لذلك، الحل الصحيح هو نموذج SaaS متعدد المستأجرين مع Supabase و RLS.

## الملف الرئيسي للبدء

- `supabase/schema.sql`: قاعدة البيانات كاملة
- `supabase/client.js`: مثال توصيل الواجهة بالـ Supabase
- `app.js`: التطبيق الحالي، يحتاج إلى ترحيل بعد إعداد قاعدة البيانات
