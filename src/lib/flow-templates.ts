/**
 * Pre-built flow templates for 8 business types.
 *
 * Each template is a complete flow graph (nodes + edges) that can be
 * imported into the flows table. All text is in Mongolian.
 */

import type { FlowNode, FlowEdge, TriggerType, TriggerConfig } from './flow-types'

export interface FlowTemplate {
  business_type: string
  name: string
  description: string
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// ---------------------------------------------------------------------------
// Helper to create nodes/edges with consistent IDs
// ---------------------------------------------------------------------------

let _nodeCounter = 0
function n(type: FlowNode['type'], label: string, x: number, y: number, config: Record<string, unknown>): FlowNode {
  _nodeCounter++
  return { id: `n${_nodeCounter}`, type, position: { x, y }, data: { label, config: { type, ...config } as FlowNode['data']['config'] } }
}

function e(source: string, target: string, handle?: string, label?: string): FlowEdge {
  return { id: `e_${source}_${target}${handle ? '_' + handle : ''}`, source, target, sourceHandle: handle, label }
}

// ---------------------------------------------------------------------------
// 1. Restaurant — Order Taking
// ---------------------------------------------------------------------------
function restaurantTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('send_message', 'Мэндчилгээ', 250, 100, { text: 'Манай цэснээс юу захиалах вэ? Доорх жагсаалтаас сонгоно уу.' }),
    n('show_items', 'Цэс харуулах', 250, 200, { source: 'products', display_format: 'list', selection_variable: 'selected_item', max_items: 8 }),
    n('ask_question', 'Тоо хэмжээ', 250, 300, { question_text: 'Хэд ширхэг авах вэ?', variable_name: 'quantity', validation: 'number', error_message: 'Тоо оруулна уу (жиш: 1, 2, 3).' }),
    n('button_choice', 'Хүргэлт', 250, 400, { question_text: 'Хүргэлт үү, очиж авах уу?', variable_name: 'delivery_type', buttons: [{ label: 'Хүргэлт', value: 'delivery' }, { label: 'Очиж авах', value: 'pickup' }] }),
    n('ask_question', 'Хаяг', 100, 500, { question_text: 'Хүргэлтийн хаягаа бичнэ үү.', variable_name: 'address', validation: 'text' }),
    n('ask_question', 'Утас', 250, 600, { question_text: 'Утасны дугаараа бичнэ үү.', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Баталгаа', 250, 700, { text: 'Захиалга: {{selected_item}} x{{quantity}}\nХүргэлт: {{delivery_type}}\nУтас: {{phone}}' }),
    n('end', 'Төгсгөл', 250, 800, { message: 'Баярлалаа! Захиалга таны гар дээр удахгүй хүрнэ.' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'), e('n4', 'n5'),
    e('n5', 'n6', 'button_0', 'Хүргэлт'), e('n5', 'n7', 'button_1', 'Очиж авах'),
    e('n6', 'n7'), e('n7', 'n8'), e('n8', 'n9'),
  ]
  return { business_type: 'restaurant', name: 'Хоол захиалга', description: 'Цэс → сонголт → хүргэлт/очих → утас → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['захиалга', 'order', 'цэс', 'menu'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 2. Hospital — Appointment Booking
// ---------------------------------------------------------------------------
function hospitalTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('send_message', 'Мэндчилгээ', 250, 100, { text: 'Манай эмнэлэгт цаг авахад тавтай морил!' }),
    n('button_choice', 'Тасаг', 250, 200, { question_text: 'Аль тасагт үзүүлэх вэ?', variable_name: 'department', buttons: [{ label: 'Ерөнхий үзлэг', value: 'general' }, { label: 'Дотрын тасаг', value: 'internal' }, { label: 'Нүдний тасаг', value: 'eye' }, { label: 'Хүүхдийн тасаг', value: 'pediatric' }] }),
    n('ask_question', 'Огноо', 250, 300, { question_text: 'Хэзээ ирэхийг хүсэж байна вэ? (огноо бичнэ үү)', variable_name: 'preferred_date', validation: 'date' }),
    n('ask_question', 'Нэр', 250, 400, { question_text: 'Өвчтөний нэр', variable_name: 'patient_name', validation: 'text' }),
    n('ask_question', 'Утас', 250, 500, { question_text: 'Утасны дугаар', variable_name: 'phone', validation: 'phone' }),
    n('button_choice', 'Даатгал', 250, 600, { question_text: 'Даатгалтай юу?', variable_name: 'has_insurance', buttons: [{ label: 'Тийм', value: 'yes' }, { label: 'Үгүй', value: 'no' }] }),
    n('send_message', 'Баталгаа', 250, 700, { text: 'Цаг захиалагдлаа!\nТасаг: {{department}}\nОгноо: {{preferred_date}}\n{{patient_name}}, утас: {{phone}}' }),
    n('end', 'Төгсгөл', 250, 800, { message: 'Бид баталгаажуулах мессеж илгээнэ. Баярлалаа!' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'), e('n4', 'n5'),
    e('n5', 'n6'), e('n6', 'n7'), e('n7', 'n8'), e('n8', 'n9'),
  ]
  return { business_type: 'hospital', name: 'Цаг захиалга (Эмнэлэг)', description: 'Тасаг → огноо → нэр/утас → даатгал → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['цаг', 'захиалах', 'үзлэг', 'appointment'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 3. Beauty Salon — Service Booking
// ---------------------------------------------------------------------------
function beautySalonTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('button_choice', 'Үйлчилгээ', 250, 100, { question_text: 'Ямар үйлчилгээ авах вэ?', variable_name: 'service_category', buttons: [{ label: 'Үсчин', value: 'Үсчин' }, { label: 'Маникюр', value: 'Маникюр/Педикюр' }, { label: 'Нүүр арчилгаа', value: 'Нүүр арчилгаа' }, { label: 'Массаж', value: 'Массаж' }] }),
    n('show_items', 'Жагсаалт', 250, 200, { source: 'services', filter_category: '{{service_category}}', display_format: 'list', selection_variable: 'selected_service', max_items: 8 }),
    n('ask_question', 'Цаг', 250, 300, { question_text: 'Хэзээ ирэх вэ? (огноо, цаг)', variable_name: 'preferred_time', validation: 'text' }),
    n('ask_question', 'Нэр', 250, 400, { question_text: 'Нэрээ бичнэ үү.', variable_name: 'customer_name', validation: 'text' }),
    n('ask_question', 'Утас', 250, 500, { question_text: 'Утасны дугаар', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Баталгаа', 250, 600, { text: '{{selected_service}} — {{preferred_time}}\n{{customer_name}}, {{phone}}\nБид баталгаажуулах мессеж илгээнэ.' }),
    n('end', 'Төгсгөл', 250, 700, { message: 'Баярлалаа! Тантай уулзахыг хүлээж байна.' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'),
    e('n4', 'n5'), e('n5', 'n6'), e('n6', 'n7'), e('n7', 'n8'),
  ]
  return { business_type: 'beauty_salon', name: 'Цаг захиалга (Салон)', description: 'Үйлчилгээ → сонголт → цаг → нэр/утас → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['цаг', 'захиалах', 'үйлчилгээ', 'booking'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 4. Coffee Shop — Quick Order
// ---------------------------------------------------------------------------
function coffeeShopTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('show_items', 'Цэс', 250, 100, { source: 'products', display_format: 'list', selection_variable: 'drink', max_items: 8 }),
    n('button_choice', 'Хэмжээ', 250, 200, { question_text: 'Хэмжээ сонгоно уу', variable_name: 'size', buttons: [{ label: 'Жижиг', value: 'small' }, { label: 'Дунд', value: 'medium' }, { label: 'Том', value: 'large' }] }),
    n('button_choice', 'Хүргэлт', 250, 300, { question_text: 'Очиж авах уу, хүргэлт үү?', variable_name: 'delivery_type', buttons: [{ label: 'Очиж авах', value: 'pickup' }, { label: 'Хүргэлт', value: 'delivery' }] }),
    n('ask_question', 'Утас', 250, 400, { question_text: 'Утасны дугаараа бичнэ үү.', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Баталгаа', 250, 500, { text: '{{drink}} ({{size}})\n{{delivery_type}}\nУтас: {{phone}}' }),
    n('end', 'Төгсгөл', 250, 600, { message: 'Таны кофе бэлтгэгдэж байна! ☕' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'),
    e('n4', 'n5'), e('n5', 'n6'), e('n6', 'n7'),
  ]
  return { business_type: 'coffee_shop', name: 'Кофе захиалга', description: 'Ундаа → хэмжээ → хүргэлт → утас → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['захиалга', 'order', 'кофе', 'ундаа'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 5. Fitness — Membership Inquiry
// ---------------------------------------------------------------------------
function fitnessTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('button_choice', 'Сонирхол', 250, 100, { question_text: 'Юуны талаар сонирхож байна?', variable_name: 'inquiry_type', buttons: [{ label: 'Гишүүнчлэл', value: 'membership' }, { label: 'Туршилт', value: 'trial' }, { label: 'Хичээлийн хуваарь', value: 'schedule' }] }),
    n('send_message', 'Гишүүнчлэл', 100, 250, { text: 'Гишүүнчлэлийн үнэ:\n• Сарын: 120,000₮\n• 3 сар: 300,000₮\n• 6 сар: 550,000₮\n• 12 сар: 960,000₮' }),
    n('send_message', 'Туршилт', 250, 250, { text: '3 удаагийн туршилт: 30,000₮\nБүрэн тоноглогдсон gym, бүлгийн хичээлүүд.' }),
    n('send_message', 'Хуваарь', 400, 250, { text: 'Хичээлийн хуваарь:\n• Йога: Дав/Лха/Баа 07:00, 18:00\n• Пилатес: Мяг/Пүр 10:00, 19:00\n• Кроссфит: Өдөр бүр 08:00, 17:00' }),
    n('button_choice', 'Бүртгэл', 250, 400, { question_text: 'Бүртгүүлэх үү?', variable_name: 'wants_register', buttons: [{ label: 'Тийм', value: 'yes' }, { label: 'Дараа', value: 'no' }] }),
    n('ask_question', 'Нэр', 250, 500, { question_text: 'Нэрээ бичнэ үү.', variable_name: 'name', validation: 'text' }),
    n('ask_question', 'Утас', 250, 600, { question_text: 'Утасны дугаар', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Амжилттай', 250, 700, { text: '{{name}}, бүртгэл амжилттай! Бид тантай {{phone}} дугаараар холбогдоно.' }),
    n('end', 'Төгсгөл', 250, 800, { message: 'Баярлалаа!' }),
    n('end', 'Дараа', 400, 400, { message: 'Асуулт байвал бичээрэй!' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'),
    e('n2', 'n3', 'button_0', 'Гишүүнчлэл'),
    e('n2', 'n4', 'button_1', 'Туршилт'),
    e('n2', 'n5', 'button_2', 'Хуваарь'),
    e('n3', 'n6'), e('n4', 'n6'), e('n5', 'n6'),
    e('n6', 'n7', 'button_0', 'Тийм'), e('n6', 'n11', 'button_1', 'Дараа'),
    e('n7', 'n8'), e('n8', 'n9'), e('n9', 'n10'),
  ]
  return { business_type: 'fitness', name: 'Гишүүнчлэл лавлагаа', description: 'Сонирхол → мэдээлэл → бүртгэл → нэр/утас', trigger_type: 'keyword', trigger_config: { keywords: ['гишүүнчлэл', 'membership', 'бүртгэл', 'үнэ'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 6. Education — Course Enrollment
// ---------------------------------------------------------------------------
function educationTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('show_items', 'Курсууд', 250, 100, { source: 'services', display_format: 'list', selection_variable: 'selected_course', max_items: 8 }),
    n('button_choice', 'Хуваарь', 250, 200, { question_text: 'Хуваарь сонгоно уу', variable_name: 'schedule', buttons: [{ label: 'Өглөө 09:00', value: 'morning' }, { label: 'Өдөр 14:00', value: 'afternoon' }, { label: 'Орой 18:00', value: 'evening' }, { label: 'Онлайн', value: 'online' }] }),
    n('ask_question', 'Нэр', 250, 300, { question_text: 'Суралцагчийн нэр', variable_name: 'student_name', validation: 'text' }),
    n('ask_question', 'Утас', 250, 400, { question_text: 'Утасны дугаар', variable_name: 'phone', validation: 'phone' }),
    n('button_choice', 'Төлбөр', 250, 500, { question_text: 'Төлбөрийн хэлбэр', variable_name: 'payment_method', buttons: [{ label: 'QPay', value: 'qpay' }, { label: 'Дансаар', value: 'bank' }, { label: 'Бэлнээр', value: 'cash' }] }),
    n('send_message', 'Баталгаа', 250, 600, { text: 'Бүртгэл: {{selected_course}}\nХуваарь: {{schedule}}\n{{student_name}}, {{phone}}\nТөлбөр: {{payment_method}}' }),
    n('end', 'Төгсгөл', 250, 700, { message: 'Бүртгэл амжилттай! Эхлэх хугацааг мэдэгдэнэ.' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'),
    e('n4', 'n5'), e('n5', 'n6'), e('n6', 'n7'), e('n7', 'n8'),
  ]
  return { business_type: 'education', name: 'Курс бүртгэл', description: 'Курс → хуваарь → нэр/утас → төлбөр → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['курс', 'бүртгэл', 'сургалт', 'enrollment'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 7. Dental Clinic — Appointment + Emergency Triage
// ---------------------------------------------------------------------------
function dentalClinicTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('button_choice', 'Төрөл', 250, 100, { question_text: 'Юуны талаар хандаж байна вэ?', variable_name: 'visit_type', buttons: [{ label: 'Цаг захиалах', value: 'booking' }, { label: 'Яаралтай', value: 'emergency' }, { label: 'Үнийн мэдээлэл', value: 'pricing' }] }),
    // Booking branch
    n('show_items', 'Үйлчилгээ', 100, 250, { source: 'services', display_format: 'list', selection_variable: 'treatment', max_items: 8 }),
    n('ask_question', 'Огноо', 100, 350, { question_text: 'Хүссэн огноо', variable_name: 'date', validation: 'text' }),
    n('ask_question', 'Нэр', 100, 450, { question_text: 'Нэр', variable_name: 'name', validation: 'text' }),
    n('ask_question', 'Утас', 100, 550, { question_text: 'Утас', variable_name: 'phone', validation: 'phone' }),
    n('end', 'Цаг OK', 100, 650, { message: 'Цаг захиалагдлаа! Баталгаажуулах мессеж илгээнэ.' }),
    // Emergency branch
    n('send_message', 'Яаралтай', 250, 250, { text: 'Та нэн даруй манай эмнэлэгт ирнэ үү.\nЯаралтай утас: 7011-1234.\nАжлын цаг: 09:00-18:00.' }),
    n('handoff', 'Оператор', 250, 350, { message: 'Яаралтай тусламжийн хүсэлт ирлээ.' }),
    // Pricing branch
    n('show_items', 'Үнэ', 400, 250, { source: 'services', display_format: 'list', max_items: 8 }),
    n('end', 'Үнэ OK', 400, 350, { message: 'Нэмэлт мэдээлэл хэрэгтэй бол бичээрэй!' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'),
    e('n2', 'n3', 'button_0', 'Цаг'), e('n2', 'n8', 'button_1', 'Яаралтай'), e('n2', 'n10', 'button_2', 'Үнэ'),
    e('n3', 'n4'), e('n4', 'n5'), e('n5', 'n6'), e('n6', 'n7'),
    e('n8', 'n9'),
    e('n10', 'n11'),
  ]
  return { business_type: 'dental_clinic', name: 'Шүдний цаг/яаралтай', description: 'Төрөл → цаг захиалга / яаралтай тусламж / үнэ', trigger_type: 'keyword', trigger_config: { keywords: ['цаг', 'захиалах', 'шүд', 'dental', 'яаралтай'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 8. Real Estate — Property Search
// ---------------------------------------------------------------------------
function realEstateTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('button_choice', 'Төрөл', 250, 100, { question_text: 'Юу хайж байна?', variable_name: 'property_type', buttons: [{ label: 'Орон сууц', value: 'Орон сууц' }, { label: 'Газар', value: 'Газар' }, { label: 'Түрээс', value: 'Түрээс' }, { label: 'Оффис', value: 'Оффис' }] }),
    n('button_choice', 'Байршил', 250, 200, { question_text: 'Байршил', variable_name: 'location', buttons: [{ label: 'Баянгол', value: 'Баянгол' }, { label: 'Сүхбаатар', value: 'Сүхбаатар' }, { label: 'Хан-Уул', value: 'Хан-Уул' }, { label: 'Бусад', value: 'Бусад' }] }),
    n('ask_question', 'Төсөв', 250, 300, { question_text: 'Төсөв (сая ₮)', variable_name: 'budget', validation: 'number' }),
    n('show_items', 'Зарууд', 250, 400, { source: 'products', filter_category: '{{property_type}}', display_format: 'list', selection_variable: 'selected_property', max_items: 6 }),
    n('button_choice', 'Үзэх', 250, 500, { question_text: 'Үзэхийг хүсч байна уу?', variable_name: 'wants_viewing', buttons: [{ label: 'Тийм', value: 'yes' }, { label: 'Үгүй', value: 'no' }] }),
    n('ask_question', 'Нэр', 150, 600, { question_text: 'Нэр', variable_name: 'name', validation: 'text' }),
    n('ask_question', 'Утас', 150, 700, { question_text: 'Утас', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Баталгаа', 150, 800, { text: 'Үзлэг: {{selected_property}}\n{{name}}, {{phone}}\nАгент тантай холбогдоно.' }),
    n('end', 'Төгсгөл', 150, 900, { message: 'Баярлалаа!' }),
    n('end', 'Үгүй', 350, 600, { message: 'Шинэ зарууд нэмэгдэхэд мэдэгдэнэ!' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'), e('n4', 'n5'), e('n5', 'n6'),
    e('n6', 'n7', 'button_0', 'Тийм'), e('n6', 'n11', 'button_1', 'Үгүй'),
    e('n7', 'n8'), e('n8', 'n9'), e('n9', 'n10'),
  ]
  return { business_type: 'real_estate', name: 'Үл хөдлөх хайлт', description: 'Төрөл → байршил → төсөв → зарууд → үзлэг', trigger_type: 'keyword', trigger_config: { keywords: ['орон сууц', 'газар', 'түрээс', 'хайх', 'property'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// 9. Camping / Guesthouse — Resource Booking
// ---------------------------------------------------------------------------
function campingGuesthouseTemplate(): FlowTemplate {
  _nodeCounter = 0
  const nodes: FlowNode[] = [
    n('trigger', 'Эхлэх', 250, 0, {}),
    n('send_message', 'Мэндчилгээ', 250, 100, { text: 'Манай зочид буудал / кемпинг-д тавтай морил! Та байр захиалахад бэлэн үү?' }),
    n('button_choice', 'Байрны төрөл', 250, 200, { question_text: 'Ямар байрнд байрлах вэ?', variable_name: 'resource_type', buttons: [{ label: 'Монгол гэр', value: 'ger' }, { label: 'Өрөө', value: 'room' }, { label: 'Майхан', value: 'tent_site' }, { label: 'Модон байшин', value: 'cabin' }] }),
    n('ask_question', 'Ирэх огноо', 250, 300, { question_text: 'Хэзээ ирэх вэ? (огноо)', variable_name: 'check_in_date', validation: 'date' }),
    n('ask_question', 'Гарах огноо', 250, 400, { question_text: 'Хэзээ гарах вэ? (огноо)', variable_name: 'check_out_date', validation: 'date' }),
    n('ask_question', 'Хүн тоо', 250, 500, { question_text: 'Хэдэн хүн байрлах вэ?', variable_name: 'party_size', validation: 'number', error_message: 'Хүний тоо оруулна уу (жиш: 2, 4).' }),
    n('show_items', 'Байрны жагсаалт', 250, 600, { source: 'services', filter_category: '{{resource_type}}', display_format: 'list', selection_variable: 'selected_resource', max_items: 6 }),
    n('ask_question', 'Нэр', 250, 700, { question_text: 'Нэрээ бичнэ үү.', variable_name: 'customer_name', validation: 'text' }),
    n('ask_question', 'Утас', 250, 800, { question_text: 'Утасны дугаар', variable_name: 'phone', validation: 'phone' }),
    n('send_message', 'Баталгаа', 250, 900, { text: 'Захиалга:\n{{selected_resource}}\nИрэх: {{check_in_date}}\nГарах: {{check_out_date}}\nХүн: {{party_size}}\n{{customer_name}}, {{phone}}' }),
    n('end', 'Төгсгөл', 250, 1000, { message: 'Баярлалаа! Бид баталгаажуулах мессеж илгээнэ. Тавтай морилно уу!' }),
  ]
  const edges: FlowEdge[] = [
    e('n1', 'n2'), e('n2', 'n3'), e('n3', 'n4'), e('n4', 'n5'),
    e('n5', 'n6'), e('n6', 'n7'), e('n7', 'n8'), e('n8', 'n9'),
    e('n9', 'n10'), e('n10', 'n11'),
  ]
  return { business_type: 'camping_guesthouse', name: 'Байр захиалга', description: 'Байрны төрөл → огноо → хүн тоо → сонголт → нэр/утас → баталгаа', trigger_type: 'keyword', trigger_config: { keywords: ['захиалга', 'байр', 'гэр', 'өрөө', 'booking', 'reserve'], match_mode: 'any' }, nodes, edges }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const ALL_TEMPLATES: FlowTemplate[] = [
  restaurantTemplate(),
  hospitalTemplate(),
  beautySalonTemplate(),
  coffeeShopTemplate(),
  fitnessTemplate(),
  educationTemplate(),
  dentalClinicTemplate(),
  realEstateTemplate(),
  campingGuesthouseTemplate(),
]

export function getFlowTemplate(businessType: string): FlowTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.business_type === businessType)
}

export function getAllFlowTemplates(): FlowTemplate[] {
  return ALL_TEMPLATES
}
