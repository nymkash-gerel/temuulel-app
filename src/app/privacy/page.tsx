import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Нууцлалын бодлого | Privacy Policy",
  description:
    "Temuulel платформын нууцлалын бодлого. Privacy Policy for the Temuulel platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <span className="text-white font-bold text-xl">TEMUULEL</span>
            </Link>
            <Link
              href="/terms"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Үйлчилгээний нөхцөл
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Нууцлалын бодлого
          </h1>
          <p className="text-slate-400 text-lg">Privacy Policy</p>
          <p className="text-slate-500 text-sm mt-2">
            Сүүлд шинэчилсэн / Last updated: 2026-03-28
          </p>
        </div>

        <div className="space-y-12">
          {/* Section 1 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              1. Ерөнхий мэдээлэл
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Энэхүү нууцлалын бодлого нь Temuulel LLC (цаашид
                &quot;Компани&quot;, &quot;бид&quot;) -ийн Temuulel платформоор
                (цаашид &quot;Үйлчилгээ&quot;) дамжуулан таны хувийн
                мэдээллийг хэрхэн цуглуулж, ашиглаж, хамгаалж байгааг
                тайлбарлана.
              </p>
              <p>
                Бид таны нууцлалыг хамгаалахад чухлаар хандаж, Монгол Улсын
                Хувь хүний мэдээлэл хамгаалах тухай хууль болон олон улсын
                стандартыг баримтална.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                This Privacy Policy explains how Temuulel LLC
                (&quot;Company,&quot; &quot;we&quot;) collects, uses, and
                protects your personal information through the Temuulel platform
                (&quot;Service&quot;). We take your privacy seriously and comply
                with Mongolia&apos;s Personal Data Protection Law and
                international standards.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              2. Цуглуулдаг мэдээлэл
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бид дараах төрлийн мэдээллийг цуглуулж болно:
              </p>

              <h3 className="text-white font-medium mt-4">
                2.1 Хэрэглэгчийн мэдээлэл
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Нэр, овог</li>
                <li>Утасны дугаар</li>
                <li>Имэйл хаяг</li>
                <li>Хүргэлтийн хаяг</li>
                <li>Бүртгэлийн мэдээлэл (нэвтрэх нэр, нууц үг - шифрлэгдсэн)</li>
              </ul>

              <h3 className="text-white font-medium mt-4">
                2.2 Бизнесийн мэдээлэл
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Бизнесийн нэр, төрөл</li>
                <li>Бүтээгдэхүүний мэдээлэл, зураг</li>
                <li>Захиалгын түүх, борлуулалтын өгөгдөл</li>
              </ul>

              <h3 className="text-white font-medium mt-4">
                2.3 Техникийн мэдээлэл
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>IP хаяг, хөтчийн төрөл</li>
                <li>Төхөөрөмжийн мэдээлэл</li>
                <li>Хэрэглээний лог, хандалтын бүртгэл</li>
                <li>GPS байршлын мэдээлэл (хүргэлтийн жолооч нарт)</li>
              </ul>

              <h3 className="text-white font-medium mt-4">
                2.4 Харилцааны мэдээлэл
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>AI чатбот-тай хийсэн харилцааны түүх</li>
                <li>
                  Telegram, Facebook Messenger, SMS-ээр дамжуулсан мессежүүд
                </li>
                <li>Дэмжлэгийн хүсэлтүүд</li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We may collect: (2.1) User information — name, phone number,
                email, delivery address, account credentials (encrypted); (2.2)
                Business information — business name/type, product details,
                order history, sales data; (2.3) Technical information — IP
                address, browser type, device info, usage logs, GPS location
                (for delivery drivers); (2.4) Communication data — AI chatbot
                conversation history, messages via Telegram/Facebook
                Messenger/SMS, and support requests.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              3. Мэдээлэл ашиглах зорилго
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>Бид таны мэдээллийг дараах зорилгоор ашиглана:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Үйлчилгээг үзүүлэх, сайжруулах</li>
                <li>Захиалга боловсруулах, хүргэлт зохион байгуулах</li>
                <li>
                  AI чатботын хариултыг сайжруулах (таны бизнесийн контексттой)
                </li>
                <li>Төлбөр боловсруулах</li>
                <li>
                  Push мэдэгдэл илгээх (захиалгын статус, урамшуулал)
                </li>
                <li>Аналитик тайлан гаргах</li>
                <li>Аюулгүй байдлыг хангах, залилан илрүүлэх</li>
                <li>Хуулийн шаардлагыг биелүүлэх</li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We use your data to: provide and improve the Service; process
                orders and organize deliveries; improve AI chatbot responses
                (with your business context); process payments; send push
                notifications (order status, promotions); generate analytics
                reports; ensure security and detect fraud; and comply with legal
                requirements.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              4. Гуравдагч талын үйлчилгээ ба мэдээлэл дамжуулалт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бид үйлчилгээгээ үзүүлэхэд дараах гуравдагч талын
                үйлчилгээнүүдтэй мэдээлэл хуваалцаж болно:
              </p>
              <div className="space-y-4 mt-4">
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-1">Supabase</h4>
                  <p className="text-sm">
                    Мэдээллийн сан хадгалалт, хэрэглэгчийн нэвтрэлт. Таны
                    бүртгэлийн мэдээлэл, бизнесийн өгөгдөл Supabase-ийн
                    серверт хадгалагдана.
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-1">OpenAI</h4>
                  <p className="text-sm">
                    AI чатботын хариулт боловсруулалт. Хэрэглэгчийн асуулт,
                    бүтээгдэхүүний мэдээлэл OpenAI-ийн API-д дамжуулагдана.
                    OpenAI нь энэ мэдээллийг модель сургалтанд ашиглахгүй (API
                    нөхцөлийн дагуу).
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-1">Sentry</h4>
                  <p className="text-sm">
                    Алдааны хяналт, системийн тогтвортой байдал. Техникийн
                    алдааны мэдээлэл (хувийн мэдээлэл агуулахгүй) Sentry-д
                    дамжуулагдана.
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-1">QPay</h4>
                  <p className="text-sm">
                    Төлбөр боловсруулалт. Төлбөрийн мэдээлэл QPay-ийн
                    аюулгүй серверт боловсруулагдана. Бид таны банкны картын
                    мэдээллийг хадгалдаггүй.
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-1">
                    Telegram / Facebook Messenger / SMS
                  </h4>
                  <p className="text-sm">
                    Мессежийн суваг. Хэрэглэгчтэй харилцах мессежийн
                    мэдээлэл тухайн платформын серверт дамжина.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We share data with the following third-party services: Supabase
                (database storage, authentication — your account and business
                data is stored on Supabase servers); OpenAI (AI chatbot
                processing — user queries and product info are sent to
                OpenAI&apos;s API, which does not use this data for model
                training per their API terms); Sentry (error monitoring —
                technical error data without personal information); QPay
                (payment processing — payment data is processed on QPay&apos;s
                secure servers; we do not store card details); Telegram /
                Facebook Messenger / SMS (messaging channels — message data
                passes through each platform&apos;s servers).
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              5. Күүки (Cookies) ба хяналтын технологи
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>Бид дараах зорилгоор күүки ашигладаг:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Зайлшгүй шаардлагатай күүки:</strong> Нэвтрэлт,
                  сессийн менежмент
                </li>
                <li>
                  <strong>Функциональ күүки:</strong> Хэрэглэгчийн тохиргоо,
                  хэлний сонголт хадгалах
                </li>
                <li>
                  <strong>Аналитик күүки:</strong> Хэрэглээний статистик
                  цуглуулах
                </li>
              </ul>
              <p>
                Та хөтчийнхөө тохиргоогоор күүки идэвхгүй болгох боломжтой.
                Гэхдээ зарим функц зөв ажиллахгүй байж болно.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We use cookies for: essential cookies (authentication, session
                management); functional cookies (user preferences, language
                settings); and analytics cookies (usage statistics). You can
                disable cookies in your browser settings, but some features may
                not function properly.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              6. Мэдээллийн хамгаалалт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бид таны мэдээллийг хамгаалахад дараах арга хэмжээг авна:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>SSL/TLS шифрлэлт (мэдээлэл дамжуулалт)</li>
                <li>Нууц үгийн хэш шифрлэлт (bcrypt/argon2)</li>
                <li>
                  Мэдээллийн сангийн хандалтын хяналт (Row Level Security)
                </li>
                <li>
                  Олон хэрэглэгчтэй тусгаарлалт (tenant isolation)
                </li>
                <li>Тогтмол аюулгүй байдлын аудит</li>
                <li>Ажилтнуудын мэдээлэл хамгаалах сургалт</li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We protect your data through: SSL/TLS encryption (data in
                transit); password hashing (bcrypt/argon2); database access
                controls (Row Level Security); multi-tenant isolation; regular
                security audits; and staff data protection training.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              7. Мэдээлэл хадгалах хугацаа
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бид мэдээллийг дараах хугацаагаар хадгална:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Хэрэглэгчийн данс:</strong> Данс идэвхтэй байх
                  хугацаанд + устгаснаас хойш 30 хоног
                </li>
                <li>
                  <strong>Захиалгын мэдээлэл:</strong> 3 жил (санхүүгийн
                  тайлагналын шаардлага)
                </li>
                <li>
                  <strong>Чатботын түүх:</strong> 1 жил
                </li>
                <li>
                  <strong>Техникийн лог:</strong> 90 хоног
                </li>
                <li>
                  <strong>Аналитик мэдээлэл:</strong> 2 жил (нэр нууцалсан
                  хэлбэрээр)
                </li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Data retention periods: account data — while active + 30 days
                after deletion; order data — 3 years (financial reporting
                requirements); chatbot history — 1 year; technical logs — 90
                days; analytics data — 2 years (in anonymized form).
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              8. Таны эрхүүд
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Та дараах эрхүүдийг эдлэх боломжтой:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Мэдээлэл авах эрх:</strong> Бидний хадгалж буй таны
                  мэдээллийн хуулбарыг хүсэх
                </li>
                <li>
                  <strong>Засварлах эрх:</strong> Буруу мэдээллийг залруулах
                  хүсэлт гаргах
                </li>
                <li>
                  <strong>Устгах эрх:</strong> Таны мэдээллийг устгахыг хүсэх
                  (хуулиар хадгалах шаардлагатай мэдээллээс бусад)
                </li>
                <li>
                  <strong>Экспортлох эрх:</strong> Таны мэдээллийг
                  машинаар унших боломжтой форматаар авах
                </li>
                <li>
                  <strong>Татгалзах эрх:</strong> Маркетингийн мэдэгдлээс
                  татгалзах
                </li>
                <li>
                  <strong>Хязгаарлах эрх:</strong> Мэдээлэл боловсруулалтыг
                  хязгаарлах хүсэлт гаргах
                </li>
              </ul>
              <p className="mt-4">
                Эдгээр эрхээ хэрэгжүүлэхийн тулд{" "}
                <a
                  href="mailto:support@temuulel.com"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  support@temuulel.com
                </a>{" "}
                хаягаар хандана уу. Бид 30 хоногийн дотор хариу өгнө.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Your rights include: right to access (request a copy of your
                data); right to rectification (correct inaccurate data); right
                to erasure (request deletion, except legally required data);
                right to data portability (receive data in machine-readable
                format); right to opt out (unsubscribe from marketing
                notifications); and right to restrict processing. Contact
                support@temuulel.com to exercise these rights. We will respond
                within 30 days.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              9. Хүүхдийн нууцлал
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бидний үйлчилгээ 18 наснаас дээш хүмүүст зориулагдсан. Бид
                16 нас хүрээгүй хүүхдээс мэдээлэл цуглуулдаггүй. Хэрэв бид
                андуурч цуглуулсан бол нэн даруй устгана.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Our Service is intended for users 18 years and older. We do not
                knowingly collect data from children under 16. If we discover
                such data was collected inadvertently, we will delete it
                immediately.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              10. Олон улсын мэдээлэл дамжуулалт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бидний ашигладаг зарим гуравдагч талын үйлчилгээ (Supabase,
                OpenAI, Sentry) нь Монгол Улсын гадна сервертэй байж болно.
                Энэ тохиолдолд мэдээлэл олон улсын хил дамжин дамжуулагдана.
              </p>
              <p>
                Бид мэдээлэл дамжуулахдаа зохих хамгаалалтын арга хэмжээг
                (шифрлэлт, гэрээний нөхцөл) авч, аюулгүй байдлыг хангана.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Some third-party services we use (Supabase, OpenAI, Sentry) may
                have servers outside Mongolia. In such cases, data is
                transferred internationally. We ensure appropriate safeguards
                (encryption, contractual terms) are in place to protect your
                data during transfer.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              11. Бодлогын өөрчлөлт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Бид нууцлалын бодлогыг шинэчлэх эрхтэй. Чухал өөрчлөлт
                оруулах тохиолдолд 14 хоногийн өмнө мэдэгдэнэ.
              </p>
              <p>
                Шинэчилсэн огноог энэ хуудасны дээд хэсэгт байрлуулна.
                Өөрчлөлтийн дараа үйлчилгээг ашигласнаар шинэ бодлогыг
                зөвшөөрсөн гэж үзнэ.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                We may update this Privacy Policy. For material changes, we will
                provide 14 days notice. The updated date will be displayed at the
                top of this page. Continued use of the Service after changes
                constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              12. Холбоо барих
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Нууцлалын бодлоготой холбоотой асуулт, хүсэлт байвал бидэнтэй
                холбогдоно уу:
              </p>
              <ul className="list-none space-y-2 ml-2">
                <li>
                  <strong>Компани:</strong> Temuulel LLC
                </li>
                <li>
                  <strong>Имэйл:</strong>{" "}
                  <a
                    href="mailto:support@temuulel.com"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    support@temuulel.com
                  </a>
                </li>
              </ul>
              <p className="mt-4">
                Хариу хүлээх хугацаа: ажлын 5 хоног.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                For questions or requests regarding this Privacy Policy, contact
                us: Temuulel LLC, support@temuulel.com. Expected response time:
                5 business days.
              </p>
            </div>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            &larr; Нүүр хуудас руу буцах
          </Link>
          <Link
            href="/terms"
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Үйлчилгээний нөхцөл &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
