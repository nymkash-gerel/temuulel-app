/**
 * Email sending utilities using Resend
 *
 * Sends transactional emails for order confirmations,
 * new message alerts, and low stock warnings.
 */
import { Resend } from 'resend'

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

const fromEmail = () => process.env.NOTIFICATION_FROM_EMAIL || 'noreply@temuulel.com'

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('Resend not configured — skipping email')
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail(),
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Email send error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Email delivery error:', err)
    return false
  }
}

export async function sendOrderEmail(
  to: string,
  order: { order_number: string; total_amount: number; payment_method: string | null }
): Promise<boolean> {
  const amount = new Intl.NumberFormat('mn-MN').format(order.total_amount)
  const paymentLabel =
    order.payment_method === 'qpay' ? 'QPay'
    : order.payment_method === 'bank' ? 'Банк шилжүүлэг'
    : order.payment_method === 'cash' ? 'Бэлэн мөнгө'
    : 'Тодорхойгүй'

  return sendEmail(to, `Шинэ захиалга #${order.order_number}`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Шинэ захиалга ирлээ!</h2>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Захиалгын дугаар:</strong> #${order.order_number}</p>
        <p style="margin: 4px 0;"><strong>Нийт дүн:</strong> ${amount}₮</p>
        <p style="margin: 4px 0;"><strong>Төлбөр:</strong> ${paymentLabel}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Захиалгыг удирдах самбараас харна уу.
      </p>
    </div>
  `)
}

export async function sendMessageEmail(
  to: string,
  customerName: string,
  message: string
): Promise<boolean> {
  const truncated = message.length > 200 ? message.slice(0, 200) + '...' : message

  return sendEmail(to, `Шинэ мессеж: ${customerName}`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Шинэ мессеж ирлээ</h2>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Харилцагч:</strong> ${customerName}</p>
        <p style="margin: 4px 0;"><strong>Мессеж:</strong></p>
        <p style="margin: 4px 0; color: #334155;">${truncated}</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Чат хэсгээс хариу бичнэ үү.
      </p>
    </div>
  `)
}

export async function sendLowStockEmail(
  to: string,
  productName: string,
  remaining: number
): Promise<boolean> {
  return sendEmail(to, `Нөөц дуусаж байна: ${productName}`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Нөөц бага байна!</h2>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Бүтээгдэхүүн:</strong> ${productName}</p>
        <p style="margin: 4px 0;"><strong>Үлдэгдэл:</strong> ${remaining} ширхэг</p>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Бүтээгдэхүүний нөөцийг нэмэхийг зөвлөж байна.
      </p>
    </div>
  `)
}

export interface DailyReportData {
  storeName: string
  date: string
  totalOrders: number
  totalRevenue: number
  newCustomers: number
  totalMessages: number
  topProducts: { name: string; quantity: number; revenue: number }[]
}

export async function sendDailyReportEmail(
  to: string,
  report: DailyReportData
): Promise<boolean> {
  const revenue = new Intl.NumberFormat('mn-MN').format(report.totalRevenue)
  const topProductsHtml = report.topProducts.length > 0
    ? report.topProducts.map((p, i) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">${i + 1}. ${p.name}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right;">${p.quantity} ш</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right;">${new Intl.NumberFormat('mn-MN').format(p.revenue)}₮</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" style="padding: 12px; color: #94a3b8; text-align: center;">Өнөөдөр борлуулалт байхгүй</td></tr>'

  return sendEmail(to, `${report.storeName} — Өдрийн тайлан (${report.date})`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">${report.storeName} — Өдрийн тайлан</h2>
      <p style="color: #64748b; font-size: 14px; margin-bottom: 16px;">${report.date}</p>

      <table style="width: 100%; margin-bottom: 20px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 50%; padding-right: 6px;">
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e293b;">${report.totalOrders}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Захиалга</p>
            </div>
          </td>
          <td style="width: 50%; padding-left: 6px;">
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e293b;">${revenue}₮</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Орлого</p>
            </div>
          </td>
        </tr>
      </table>

      <table style="width: 100%; margin-bottom: 20px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 50%; padding-right: 6px;">
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e293b;">${report.newCustomers}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Шинэ харилцагч</p>
            </div>
          </td>
          <td style="width: 50%; padding-left: 6px;">
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e293b;">${report.totalMessages}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Мессеж</p>
            </div>
          </td>
        </tr>
      </table>

      <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 8px;">Шилдэг бүтээгдэхүүн</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 8px; text-align: left; color: #64748b; font-weight: 500;">Нэр</th>
            <th style="padding: 8px; text-align: right; color: #64748b; font-weight: 500;">Тоо</th>
            <th style="padding: 8px; text-align: right; color: #64748b; font-weight: 500;">Орлого</th>
          </tr>
        </thead>
        <tbody>
          ${topProductsHtml}
        </tbody>
      </table>

      <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
        Дэлгэрэнгүйг удирдах самбарын аналитик хэсгээс харна уу.
      </p>
    </div>
  `)
}

export async function sendTeamInviteEmail(
  to: string,
  storeName: string,
  role: string,
  inviterName: string
): Promise<boolean> {
  const roleLabel = role === 'admin' ? 'Админ' : 'Ажилтан'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com'

  return sendEmail(to, `${storeName} - Багийн урилга`, `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Танд багийн урилга ирлээ!</h2>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Дэлгүүр:</strong> ${storeName}</p>
        <p style="margin: 4px 0;"><strong>Үүрэг:</strong> ${roleLabel}</p>
        <p style="margin: 4px 0;"><strong>Урьсан:</strong> ${inviterName}</p>
      </div>
      <a href="${appUrl}/dashboard"
         style="display: inline-block; padding: 12px 24px; background: linear-gradient(to right, #3b82f6, #06b6d4); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
        Самбар руу очих
      </a>
      <p style="color: #64748b; font-size: 14px; margin-top: 16px;">
        Та аль хэдийн бүртгэлтэй тул шууд нэвтрэн орж болно.
      </p>
    </div>
  `)
}
