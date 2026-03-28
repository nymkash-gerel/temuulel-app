import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Үйлчилгээний нөхцөл | Terms of Service",
  description:
    "Temuulel платформын үйлчилгээний нөхцөл. Terms of Service for the Temuulel platform.",
};

export default function TermsOfServicePage() {
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
              href="/privacy"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Нууцлалын бодлого
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Үйлчилгээний нөхцөл
          </h1>
          <p className="text-slate-400 text-lg">Terms of Service</p>
          <p className="text-slate-500 text-sm mt-2">
            Сүүлд шинэчилсэн / Last updated: 2026-03-28
          </p>
        </div>

        <div className="space-y-12">
          {/* Section 1 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              1. Ерөнхий нөхцөл
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Энэхүү үйлчилгээний нөхцөл нь Temuulel LLC (цаашид
                &quot;Компани&quot;) -ийн Temuulel платформ (цаашид
                &quot;Үйлчилгээ&quot;) -ийг ашиглах нөхцөлийг тодорхойлно.
                Үйлчилгээг ашигласнаар та эдгээр нөхцөлийг бүрэн зөвшөөрсөн
                гэж үзнэ.
              </p>
              <p>
                Temuulel нь Монголын бизнесүүдэд (цахим худалдаа, рестораны
                үйлчилгээ, бусад) зориулсан олон хэрэглэгчтэй SaaS платформ
                бөгөөд AI чатбот, захиалгын менежмент, төлбөрийн систем,
                мессежийн суваг болон хүргэлтийн хяналтын үйлчилгээ үзүүлдэг.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                These Terms of Service govern your use of the Temuulel platform
                (&quot;Service&quot;) operated by Temuulel LLC
                (&quot;Company&quot;). By using the Service, you agree to be
                bound by these terms. Temuulel is a multi-tenant SaaS platform
                for Mongolian businesses (ecommerce, restaurants, services)
                providing AI chatbot, order management, payment processing,
                messaging channels, and delivery tracking.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              2. Бүртгэл ба данс
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Үйлчилгээг бүрэн ашиглахын тулд бүртгүүлэх шаардлагатай.
                Бүртгэл үүсгэхдээ үнэн зөв мэдээлэл өгөх, нууц үгээ нууцлах
                үүрэгтэй.
              </p>
              <p>
                Та өөрийн данс дээрх бүх үйлдэлд хариуцлага хүлээнэ. Дансны
                аюулгүй байдал зөрчигдсөн тохиолдолд нэн даруй
                support@temuulel.com хаягаар мэдэгдэнэ үү.
              </p>
              <p>
                Компани нь хуурамч мэдээлэл өгсөн, нөхцөл зөрчсөн дансыг
                түдгэлзүүлэх эсвэл устгах эрхтэй.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                You must register to use the full Service. You agree to provide
                accurate information and keep your password secure. You are
                responsible for all activity under your account. Notify us
                immediately at support@temuulel.com if your account security is
                compromised. We reserve the right to suspend or terminate
                accounts that violate these terms or provide false information.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              3. Үйлчилгээний хүрээ
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>Temuulel платформ нь дараах үйлчилгээг үзүүлнэ:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>AI чатбот:</strong> Хиймэл оюун ухаанаар удирдуулсан
                  автомат харилцагчийн үйлчилгээ
                </li>
                <li>
                  <strong>Мессежийн интеграци:</strong> Telegram, Facebook
                  Messenger, SMS сувгуудаар харилцаа
                </li>
                <li>
                  <strong>Төлбөрийн систем:</strong> QPay болон бусад Монголын
                  төлбөрийн хэрэгслүүдээр төлбөр хүлээн авах
                </li>
                <li>
                  <strong>Хүргэлтийн хяналт:</strong> GPS-ээр бодит цагт
                  хүргэлтийн байрлал хянах
                </li>
                <li>
                  <strong>Push мэдэгдэл:</strong> Захиалгын статус, урамшуулал
                  зэрэг мэдэгдэл илгээх
                </li>
                <li>
                  <strong>Аналитик:</strong> Борлуулалт, хэрэглэгчийн зан
                  төлөвийн тайлан
                </li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Temuulel provides: AI chatbot for automated customer service;
                messaging integration (Telegram, Facebook Messenger, SMS);
                payment processing via QPay and other Mongolian providers;
                real-time delivery tracking with GPS; push notifications for
                order status and promotions; and analytics dashboards for sales
                and customer behavior.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              4. Төлбөр ба захиалга
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Үйлчилгээний төлбөр нь сонгосон багцаас хамаарна. Төлбөрийг
                сар бүр урьдчилан төлнө.
              </p>
              <p>
                Үнэ өөрчлөгдсөн тохиолдолд 30 хоногийн өмнө мэдэгдэнэ. Үнэгүй
                туршилтын хугацаа дууссан тохиолдолд төлбөртэй багц руу
                шилжихийг сануулна.
              </p>
              <p>
                Төлбөр буцаалтын бодлого: Төлбөр төлсөн сарын дотор
                үйлчилгээнд сэтгэл ханамжгүй бол буцаалт хүссэн хүсэлтийг
                хүлээн авна.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Service fees depend on your chosen plan and are billed monthly in
                advance. We will provide 30 days notice before any price
                changes. After a free trial ends, you will be prompted to
                upgrade to a paid plan. Refund policy: refund requests are
                accepted within the billing month if you are unsatisfied with the
                Service.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              5. Хэрэглэгчийн үүрэг
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>Хэрэглэгч дараах зүйлийг хийхийг хориглоно:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  Хууль бус, хортой, залилах зорилготой контент байршуулах
                </li>
                <li>
                  Бусдын мэдээллийг зөвшөөрөлгүй цуглуулах, ашиглах
                </li>
                <li>
                  Платформын аюулгүй байдлыг зөрчих оролдлого хийх
                </li>
                <li>Спам, хуурамч мэдээлэл тараах</li>
                <li>
                  Үйлчилгээг гуравдагч этгээдэд дамжуулах, дахин худалдах
                </li>
              </ul>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Users must not: upload illegal, harmful, or fraudulent content;
                collect or use others&apos; data without permission; attempt to
                breach platform security; distribute spam or misinformation; or
                resell or sublicense the Service to third parties.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              6. Оюуны өмч
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Temuulel платформын загвар, код, нэр, лого болон бусад оюуны
                өмчийн эрх нь Temuulel LLC-д хамаарна.
              </p>
              <p>
                Хэрэглэгчийн оруулсан контент (бүтээгдэхүүний мэдээлэл, зураг
                гэх мэт) нь хэрэглэгчийн өмч хэвээр байна. Гэхдээ
                үйлчилгээг үзүүлэхэд шаардлагатай хэмжээнд ашиглах эрхийг
                Компанид олгоно.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                All intellectual property rights in the Temuulel platform
                (design, code, name, logo) belong to Temuulel LLC. Content
                uploaded by users (product information, images, etc.) remains the
                user&apos;s property, but you grant the Company a license to use
                it as necessary to provide the Service.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              7. Гуравдагч талын үйлчилгээ
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Temuulel нь үйлчилгээгээ үзүүлэхдээ дараах гуравдагч талын
                үйлчилгээнүүдийг ашигладаг:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <strong>Supabase:</strong> Мэдээллийн сан, хэрэглэгчийн
                  нэвтрэлт
                </li>
                <li>
                  <strong>OpenAI:</strong> AI чатбот, текст боловсруулалт
                </li>
                <li>
                  <strong>Sentry:</strong> Алдааны хяналт, системийн
                  тогтвортой байдал
                </li>
                <li>
                  <strong>QPay:</strong> Төлбөр хүлээн авах, шилжүүлэг
                </li>
                <li>
                  <strong>Telegram / Facebook:</strong> Мессежийн интеграци
                </li>
              </ul>
              <p>
                Эдгээр үйлчилгээнүүд нь тус тусын нөхцөл, нууцлалын
                бодлоготой. Компани нь гуравдагч талын үйлчилгээний саатал,
                өөрчлөлтөд хариуцлага хүлээхгүй.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Temuulel uses the following third-party services: Supabase
                (database, authentication), OpenAI (AI chatbot, text
                processing), Sentry (error monitoring, system stability), QPay
                (payment processing), and Telegram/Facebook (messaging
                integration). Each service has its own terms and privacy
                policies. The Company is not liable for disruptions or changes in
                third-party services.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              8. Хариуцлагын хязгаарлалт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Үйлчилгээг &quot;байгаа хэвээр&quot; нь үзүүлнэ. Компани нь
                дараах тохиолдолд хариуцлага хүлээхгүй:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  Системийн саатал, техникийн алдаа (давагдашгүй хүчин зүйл)
                </li>
                <li>Гуравдагч талын үйлчилгээний саатал</li>
                <li>
                  Хэрэглэгчийн буруу ашиглалтаас үүдсэн хохирол
                </li>
                <li>Интернет холболтын асуудал</li>
              </ul>
              <p>
                Аливаа тохиолдолд Компанийн хариуцлага нь тухайн хэрэглэгчийн
                сүүлийн 3 сард төлсөн үйлчилгээний төлбөрийн хэмжээнээс хэтрэхгүй.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                The Service is provided &quot;as is.&quot; The Company is not
                liable for: system downtime or technical failures (force
                majeure), third-party service disruptions, damages arising from
                user misuse, or internet connectivity issues. In any event, the
                Company&apos;s total liability shall not exceed the fees paid by
                the user in the preceding 3 months.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              9. Үйлчилгээг зогсоох
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Хэрэглэгч хүссэн үедээ дансаа цуцалж, үйлчилгээгээ зогсоох
                эрхтэй. Данс цуцлагдсаны дараа 30 хоногийн дотор мэдээллийг
                экспортлох боломжтой.
              </p>
              <p>
                Компани нь нөхцөл зөрчсөн хэрэглэгчийн дансыг мэдэгдэлгүйгээр
                зогсоох эрхтэй. Ноцтой зөрчлийн тохиолдолд мэдээлэл нэн даруй
                устгагдаж болно.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                Users may cancel their account and stop the Service at any time.
                After cancellation, you have 30 days to export your data. The
                Company reserves the right to terminate accounts that violate
                these terms without notice. In cases of serious violations, data
                may be deleted immediately.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              10. Нөхцөлийн өөрчлөлт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Компани нь эдгээр нөхцөлийг шинэчлэх эрхтэй. Чухал өөрчлөлт
                оруулах тохиолдолд 14 хоногийн өмнө имэйл эсвэл платформ
                дээрх мэдэгдлээр мэдэгдэнэ.
              </p>
              <p>
                Өөрчлөлтийн дараа үйлчилгээг үргэлжлүүлэн ашиглах нь шинэ
                нөхцөлийг зөвшөөрсөн гэсэн үг юм.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                The Company reserves the right to update these terms. For
                material changes, we will provide 14 days notice via email or
                platform notification. Continued use of the Service after
                changes constitutes acceptance of the updated terms.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              11. Хууль зүйн зохицуулалт
            </h2>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>
                Энэхүү нөхцөл нь Монгол Улсын хууль тогтоомжоор зохицуулагдана.
                Маргаан гарсан тохиолдолд Монгол Улсын шүүхээр шийдвэрлэнэ.
              </p>
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                These terms are governed by the laws of Mongolia. Any disputes
                shall be resolved in the courts of Mongolia.
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
                Үйлчилгээний нөхцөлтэй холбоотой асуулт байвал бидэнтэй
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
            </div>
            <div className="text-slate-400 text-sm border-t border-slate-700 pt-4">
              <p className="italic">
                For questions about these Terms of Service, contact us: Temuulel
                LLC, support@temuulel.com.
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
            href="/privacy"
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Нууцлалын бодлого &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
