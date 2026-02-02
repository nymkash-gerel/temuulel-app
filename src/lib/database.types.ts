export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admissions: {
        Row: {
          admit_at: string | null
          admit_diagnosis: string | null
          attending_staff_id: string | null
          created_at: string | null
          discharge_at: string | null
          discharge_summary: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          admit_at?: string | null
          admit_diagnosis?: string | null
          attending_staff_id?: string | null
          created_at?: string | null
          discharge_at?: string | null
          discharge_summary?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          admit_at?: string | null
          admit_diagnosis?: string | null
          attending_staff_id?: string | null
          created_at?: string | null
          discharge_at?: string | null
          discharge_summary?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_attending_staff_id_fkey"
            columns: ["attending_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_commissions: {
        Row: {
          agent_id: string
          agent_share: number
          commission_amount: number
          company_share: number
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_share?: number
          commission_amount?: number
          company_share?: number
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_share?: number
          commission_amount?: number
          company_share?: number
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_commissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_addons: {
        Row: {
          appointment_id: string
          created_at: string | null
          id: string
          price: number | null
          service_id: string | null
          variation_id: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          id?: string
          price?: number | null
          service_id?: string | null
          variation_id?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          id?: string
          price?: number | null
          service_id?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_addons_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_addons_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_addons_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "service_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          conversation_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          duration_minutes: number
          id: string
          internal_notes: string | null
          notes: string | null
          party_size: number | null
          payment_method: string | null
          payment_status: string | null
          resource_id: string | null
          scheduled_at: string
          service_id: string | null
          source: string | null
          staff_id: string | null
          status: string | null
          store_id: string
          total_amount: number | null
          updated_at: string | null
          variation_id: string | null
        }
        Insert: {
          check_in_date?: string | null
          check_out_date?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          internal_notes?: string | null
          notes?: string | null
          party_size?: number | null
          payment_method?: string | null
          payment_status?: string | null
          resource_id?: string | null
          scheduled_at: string
          service_id?: string | null
          source?: string | null
          staff_id?: string | null
          status?: string | null
          store_id: string
          total_amount?: number | null
          updated_at?: string | null
          variation_id?: string | null
        }
        Update: {
          check_in_date?: string | null
          check_out_date?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          duration_minutes?: number
          id?: string
          internal_notes?: string | null
          notes?: string | null
          party_size?: number | null
          payment_method?: string | null
          payment_status?: string | null
          resource_id?: string | null
          scheduled_at?: string
          service_id?: string | null
          source?: string | null
          staff_id?: string | null
          status?: string | null
          store_id?: string
          total_amount?: number | null
          updated_at?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "service_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          store_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          store_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          store_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          session_id: string
          status: string | null
          store_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          session_id: string
          status?: string | null
          store_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          session_id?: string
          status?: string | null
          store_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          store_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          store_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_assignments: {
        Row: {
          admission_id: string
          created_at: string | null
          end_at: string | null
          id: string
          start_at: string | null
          store_id: string
          unit_id: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string | null
          end_at?: string | null
          id?: string
          start_at?: string | null
          store_id: string
          unit_id?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string | null
          end_at?: string | null
          id?: string
          start_at?: string | null
          store_id?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_assignments_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          created_at: string | null
          gateway_ref: string | null
          gateway_response: Json | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          method: string
          notes: string | null
          paid_at: string | null
          payment_number: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          gateway_ref?: string | null
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          method: string
          notes?: string | null
          paid_at?: string | null
          payment_number: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          gateway_ref?: string | null
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          method?: string
          notes?: string | null
          paid_at?: string | null
          payment_number?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          block_type: string | null
          created_at: string | null
          end_at: string
          id: string
          reason: string | null
          recurring: Json | null
          resource_id: string | null
          staff_id: string | null
          start_at: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          block_type?: string | null
          created_at?: string | null
          end_at: string
          id?: string
          reason?: string | null
          recurring?: Json | null
          resource_id?: string | null
          staff_id?: string | null
          start_at: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          block_type?: string | null
          created_at?: string | null
          end_at?: string
          id?: string
          reason?: string | null
          recurring?: Json | null
          resource_id?: string | null
          staff_id?: string | null
          start_at?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bookable_resources: {
        Row: {
          capacity: number
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          images: Json | null
          name: string
          price_per_unit: number | null
          sort_order: number | null
          status: string
          store_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          images?: Json | null
          name: string
          price_per_unit?: number | null
          sort_order?: number | null
          status?: string
          store_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          images?: Json | null
          name?: string
          price_per_unit?: number | null
          sort_order?: number | null
          status?: string
          store_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookable_resources_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          appointment_id: string
          created_at: string | null
          end_at: string
          id: string
          notes: string | null
          price: number | null
          resource_id: string | null
          service_id: string | null
          staff_id: string | null
          start_at: string
          status: string | null
          store_id: string
          updated_at: string | null
          variation_id: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          end_at: string
          id?: string
          notes?: string | null
          price?: number | null
          resource_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          start_at: string
          status?: string | null
          store_id: string
          updated_at?: string | null
          variation_id?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          end_at?: string
          id?: string
          notes?: string | null
          price?: number | null
          resource_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          start_at?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "service_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document_type: string
          file_size: number | null
          file_url: string | null
          id: string
          name: string
          notes: string | null
          store_id: string
          uploaded_by: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          document_type?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          store_id: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          document_type?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          store_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          case_id: string
          created_at: string
          event_type: string
          id: string
          location: string | null
          notes: string | null
          outcome: string | null
          scheduled_at: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_orders: {
        Row: {
          address_text: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          equipment_needed: Json | null
          final_amount: number | null
          guest_count: number
          id: string
          location_type: string | null
          logistics_notes: string | null
          quoted_amount: number | null
          serving_date: string
          serving_time: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          address_text?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          equipment_needed?: Json | null
          final_amount?: number | null
          guest_count?: number
          id?: string
          location_type?: string | null
          logistics_notes?: string | null
          quoted_amount?: number | null
          serving_date: string
          serving_time: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          address_text?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          equipment_needed?: Json | null
          final_amount?: number | null
          guest_count?: number
          id?: string
          location_type?: string | null
          logistics_notes?: string | null
          quoted_amount?: number | null
          serving_date?: string
          serving_time?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          facebook_sender_id: string
          id: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          facebook_sender_id: string
          id?: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          facebook_sender_id?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      class_bookings: {
        Row: {
          booking_date: string
          class_id: string
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          class_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          class_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "fitness_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_preferences: {
        Row: {
          allergies: string[] | null
          color_history: Json | null
          created_at: string | null
          customer_id: string
          hair_type: string | null
          id: string
          notes: string | null
          preferred_staff_id: string | null
          skin_type: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          allergies?: string[] | null
          color_history?: Json | null
          created_at?: string | null
          customer_id: string
          hair_type?: string | null
          id?: string
          notes?: string | null
          preferred_staff_id?: string | null
          skin_type?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          allergies?: string[] | null
          color_history?: Json | null
          created_at?: string | null
          customer_id?: string
          hair_type?: string | null
          id?: string
          notes?: string | null
          preferred_staff_id?: string | null
          skin_type?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_preferences_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_preferences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_auto_rules: {
        Row: {
          ai_context: string | null
          comment_template: string | null
          created_at: string
          delay_seconds: number | null
          dm_template: string | null
          enabled: boolean
          id: string
          keywords: string[] | null
          last_triggered_at: string | null
          match_mode: string | null
          matches_count: number
          name: string
          platforms: string[] | null
          post_filter: Json | null
          priority: number
          replies_sent: number
          reply_comment: boolean
          reply_dm: boolean
          store_id: string
          trigger_type: string
          updated_at: string
          use_ai: boolean
        }
        Insert: {
          ai_context?: string | null
          comment_template?: string | null
          created_at?: string
          delay_seconds?: number | null
          dm_template?: string | null
          enabled?: boolean
          id?: string
          keywords?: string[] | null
          last_triggered_at?: string | null
          match_mode?: string | null
          matches_count?: number
          name: string
          platforms?: string[] | null
          post_filter?: Json | null
          priority?: number
          replies_sent?: number
          reply_comment?: boolean
          reply_dm?: boolean
          store_id: string
          trigger_type?: string
          updated_at?: string
          use_ai?: boolean
        }
        Update: {
          ai_context?: string | null
          comment_template?: string | null
          created_at?: string
          delay_seconds?: number | null
          dm_template?: string | null
          enabled?: boolean
          id?: string
          keywords?: string[] | null
          last_triggered_at?: string | null
          match_mode?: string | null
          matches_count?: number
          name?: string
          platforms?: string[] | null
          post_filter?: Json | null
          priority?: number
          replies_sent?: number
          reply_comment?: boolean
          reply_dm?: boolean
          store_id?: string
          trigger_type?: string
          updated_at?: string
          use_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comment_auto_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reply_logs: {
        Row: {
          comment_id: string
          comment_text: string | null
          commenter_id: string
          commenter_name: string | null
          created_at: string
          error_message: string | null
          id: string
          platform: string
          post_id: string
          reply_comment_id: string | null
          reply_dm_sent: boolean | null
          reply_type: string
          rule_id: string | null
          status: string
          store_id: string
        }
        Insert: {
          comment_id: string
          comment_text?: string | null
          commenter_id: string
          commenter_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platform: string
          post_id: string
          reply_comment_id?: string | null
          reply_dm_sent?: boolean | null
          reply_type: string
          rule_id?: string | null
          status?: string
          store_id: string
        }
        Update: {
          comment_id?: string
          comment_text?: string | null
          commenter_id?: string
          commenter_name?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          platform?: string
          post_id?: string
          reply_comment_id?: string | null
          reply_dm_sent?: boolean | null
          reply_type?: string
          rule_id?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reply_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "comment_auto_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reply_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_policies: {
        Row: {
          auto_approve: boolean
          compensation_type: string
          compensation_value: number
          complaint_category: string
          created_at: string
          id: string
          is_active: boolean
          max_discount_amount: number | null
          name: string
          requires_confirmation: boolean
          store_id: string
          updated_at: string
          valid_days: number
        }
        Insert: {
          auto_approve?: boolean
          compensation_type: string
          compensation_value?: number
          complaint_category: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name: string
          requires_confirmation?: boolean
          store_id: string
          updated_at?: string
          valid_days?: number
        }
        Update: {
          auto_approve?: boolean
          compensation_type?: string
          compensation_value?: number
          complaint_category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          name?: string
          requires_confirmation?: boolean
          store_id?: string
          updated_at?: string
          valid_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "compensation_policies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          consultant_id: string | null
          consultation_type: string
          created_at: string
          customer_id: string | null
          duration_minutes: number
          fee: number | null
          follow_up_date: string | null
          id: string
          location: string | null
          meeting_url: string | null
          notes: string | null
          scheduled_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          consultant_id?: string | null
          consultation_type?: string
          created_at?: string
          customer_id?: string | null
          duration_minutes?: number
          fee?: number | null
          follow_up_date?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          consultant_id?: string | null
          consultation_type?: string
          created_at?: string
          customer_id?: string | null
          duration_minutes?: number
          fee?: number | null
          follow_up_date?: string | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string | null
          created_at: string | null
          customer_id: string | null
          escalated_at: string | null
          escalation_level: string
          escalation_score: number
          id: string
          metadata: Json
          status: string | null
          store_id: string
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          escalated_at?: string | null
          escalation_level?: string
          escalation_score?: number
          id?: string
          metadata?: Json
          status?: string | null
          store_id: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          escalated_at?: string | null
          escalation_level?: string
          escalation_score?: number
          id?: string
          metadata?: Json
          status?: string | null
          store_id?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          id: string
          instructor_id: string | null
          location: string | null
          program_id: string
          scheduled_at: string
          status: string | null
          store_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          program_id: string
          scheduled_at: string
          status?: string | null
          store_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          instructor_id?: string | null
          location?: string | null
          program_id?: string
          scheduled_at?: string
          status?: string | null
          store_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coworking_spaces: {
        Row: {
          amenities: Json | null
          capacity: number
          created_at: string
          daily_rate: number | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          monthly_rate: number | null
          name: string
          space_type: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amenities?: Json | null
          capacity?: number
          created_at?: string
          daily_rate?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          monthly_rate?: number | null
          name: string
          space_type?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amenities?: Json | null
          capacity?: number
          created_at?: string
          daily_rate?: number | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          monthly_rate?: number | null
          name?: string
          space_type?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coworking_spaces_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          certifications: string[] | null
          created_at: string
          hourly_rate: number | null
          id: string
          name: string
          phone: string | null
          role: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          certifications?: string[] | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          certifications?: string[] | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_memberships: {
        Row: {
          created_at: string | null
          customer_id: string
          expires_at: string | null
          id: string
          membership_id: string
          services_used: number | null
          started_at: string | null
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          membership_id: string
          services_used?: number | null
          started_at?: string | null
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          membership_id?: string
          services_used?: number | null
          started_at?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          channel: string | null
          created_at: string | null
          email: string | null
          id: string
          instagram_id: string | null
          messenger_id: string | null
          metadata: Json | null
          name: string | null
          notes: string | null
          phone: string | null
          store_id: string
          whatsapp_id: string | null
        }
        Insert: {
          address?: string | null
          channel?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instagram_id?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          store_id: string
          whatsapp_id?: string | null
        }
        Update: {
          address?: string | null
          channel?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instagram_id?: string | null
          messenger_id?: string | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          store_id?: string
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          issues: string | null
          log_date: string
          project_id: string
          store_id: string
          updated_at: string
          weather: string | null
          work_completed: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          log_date?: string
          project_id: string
          store_id: string
          updated_at?: string
          weather?: string | null
          work_completed?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          log_date?: string
          project_id?: string
          store_id?: string
          updated_at?: string
          weather?: string | null
          work_completed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_reports: {
        Row: {
          charged_amount: number | null
          created_at: string | null
          damage_type: string | null
          description: string
          estimated_cost: number | null
          guest_id: string | null
          id: string
          photos: Json | null
          reservation_id: string | null
          status: string | null
          store_id: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          charged_amount?: number | null
          created_at?: string | null
          damage_type?: string | null
          description: string
          estimated_cost?: number | null
          guest_id?: string | null
          id?: string
          photos?: Json | null
          reservation_id?: string | null
          status?: string | null
          store_id: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          charged_amount?: number | null
          created_at?: string | null
          damage_type?: string | null
          description?: string
          estimated_cost?: number | null
          guest_id?: string | null
          id?: string
          photos?: Json | null
          reservation_id?: string | null
          status?: string | null
          store_id?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_reports_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_reports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agent_id: string | null
          agent_share_amount: number | null
          agent_share_rate: number | null
          asking_price: number | null
          closed_date: string | null
          commission_amount: number | null
          commission_rate: number | null
          company_share_amount: number | null
          contract_date: string | null
          created_at: string
          customer_id: string | null
          deal_number: string
          deal_type: string
          final_price: number | null
          id: string
          metadata: Json | null
          notes: string | null
          offer_date: string | null
          offer_price: number | null
          property_id: string | null
          status: string
          store_id: string
          updated_at: string
          viewing_date: string | null
          withdrawn_date: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_share_amount?: number | null
          agent_share_rate?: number | null
          asking_price?: number | null
          closed_date?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          company_share_amount?: number | null
          contract_date?: string | null
          created_at?: string
          customer_id?: string | null
          deal_number: string
          deal_type?: string
          final_price?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          offer_date?: string | null
          offer_price?: number | null
          property_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
          viewing_date?: string | null
          withdrawn_date?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_share_amount?: number | null
          agent_share_rate?: number | null
          asking_price?: number | null
          closed_date?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          company_share_amount?: number | null
          contract_date?: string | null
          created_at?: string
          customer_id?: string | null
          deal_number?: string
          deal_type?: string
          final_price?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          offer_date?: string | null
          offer_price?: number | null
          property_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          viewing_date?: string | null
          withdrawn_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_delivery_time: string | null
          ai_assignment: Json | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string
          delivery_fee: number | null
          delivery_number: string
          delivery_type: string
          driver_id: string | null
          estimated_delivery_time: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string | null
          pickup_address: string | null
          proof_photo_url: string | null
          provider_name: string | null
          provider_tracking_id: string | null
          scheduled_date: string | null
          scheduled_time_slot: string | null
          status: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
          ai_assignment?: Json | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address: string
          delivery_fee?: number | null
          delivery_number: string
          delivery_type?: string
          driver_id?: string | null
          estimated_delivery_time?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          pickup_address?: string | null
          proof_photo_url?: string | null
          provider_name?: string | null
          provider_tracking_id?: string | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          status?: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
          ai_assignment?: Json | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string
          delivery_fee?: number | null
          delivery_number?: string
          delivery_type?: string
          driver_id?: string | null
          estimated_delivery_time?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          pickup_address?: string | null
          proof_photo_url?: string | null
          provider_name?: string | null
          provider_tracking_id?: string | null
          scheduled_date?: string | null
          scheduled_time_slot?: string | null
          status?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          avg_rating: number | null
          created_at: string | null
          current_location: Json | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          phone: string
          rating_count: number | null
          status: string
          store_id: string
          updated_at: string | null
          user_id: string | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          avg_rating?: number | null
          created_at?: string | null
          current_location?: Json | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          phone: string
          rating_count?: number | null
          status?: string
          store_id: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          avg_rating?: number | null
          created_at?: string | null
          current_location?: Json | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          phone?: string
          rating_count?: number | null
          status?: string
          store_id?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_status_log: {
        Row: {
          changed_by: string | null
          created_at: string | null
          delivery_id: string
          id: string
          location: Json | null
          notes: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          delivery_id: string
          id?: string
          location?: Json | null
          notes?: string | null
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          delivery_id?: string
          id?: string
          location?: Json | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_log_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      desk_bookings: {
        Row: {
          booking_date: string
          created_at: string
          customer_id: string | null
          end_time: string | null
          id: string
          notes: string | null
          space_id: string
          start_time: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          customer_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          space_id: string
          start_time?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          customer_id?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          space_id?: string
          start_time?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desk_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "coworking_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_messages: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          message: string
          read_at: string | null
          sender_type: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          message: string
          read_at?: string | null
          sender_type: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_type?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_messages_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          created_at: string
          delivery_count: number
          driver_id: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          store_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_count?: number
          driver_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_count?: number
          driver_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_name: string | null
          delivery_id: string
          driver_id: string
          id: string
          rating: number
          store_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivery_id: string
          driver_id: string
          id?: string
          rating: number
          store_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          delivery_id?: string
          driver_id?: string
          id?: string
          rating?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_store_assignments: {
        Row: {
          assigned_at: string | null
          driver_id: string
          id: string
          status: string | null
          store_id: string
        }
        Insert: {
          assigned_at?: string | null
          driver_id: string
          id?: string
          status?: string | null
          store_id: string
        }
        Update: {
          assigned_at?: string | null
          driver_id?: string
          id?: string
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_store_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_store_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          chief_complaint: string | null
          created_at: string | null
          diagnosis: string | null
          diagnosis_codes: string[] | null
          encounter_date: string | null
          encounter_type: string | null
          id: string
          notes: string | null
          patient_id: string
          physical_exam: Json | null
          provider_id: string | null
          status: string | null
          store_id: string
          treatment_plan: string | null
          updated_at: string | null
          vitals: Json | null
        }
        Insert: {
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          diagnosis_codes?: string[] | null
          encounter_date?: string | null
          encounter_type?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          physical_exam?: Json | null
          provider_id?: string | null
          status?: string | null
          store_id: string
          treatment_plan?: string | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Update: {
          chief_complaint?: string | null
          created_at?: string | null
          diagnosis?: string | null
          diagnosis_codes?: string[] | null
          encounter_date?: string | null
          encounter_type?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          physical_exam?: Json | null
          provider_id?: string | null
          status?: string | null
          store_id?: string
          treatment_plan?: string | null
          updated_at?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrolled_at: string | null
          grade: string | null
          id: string
          notes: string | null
          program_id: string
          status: string | null
          store_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          grade?: string | null
          id?: string
          notes?: string | null
          program_id: string
          status?: string | null
          store_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          grade?: string | null
          id?: string
          notes?: string | null
          program_id?: string
          status?: string | null
          store_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          equipment_type: string
          id: string
          last_maintenance: string | null
          location: string | null
          name: string
          next_maintenance: string | null
          notes: string | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipment_type?: string
          id?: string
          last_maintenance?: string | null
          location?: string | null
          name: string
          next_maintenance?: string | null
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipment_type?: string
          id?: string
          last_maintenance?: string | null
          location?: string | null
          name?: string
          next_maintenance?: string | null
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          budget_estimate: number | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          event_date: string
          event_end_time: string | null
          event_start_time: string | null
          event_type: string | null
          final_amount: number | null
          guest_count: number
          id: string
          menu_selection: Json | null
          quoted_amount: number | null
          setup_notes: string | null
          special_requirements: string | null
          status: string | null
          store_id: string
          updated_at: string | null
          venue_resource_id: string | null
        }
        Insert: {
          budget_estimate?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          event_date: string
          event_end_time?: string | null
          event_start_time?: string | null
          event_type?: string | null
          final_amount?: number | null
          guest_count?: number
          id?: string
          menu_selection?: Json | null
          quoted_amount?: number | null
          setup_notes?: string | null
          special_requirements?: string | null
          status?: string | null
          store_id: string
          updated_at?: string | null
          venue_resource_id?: string | null
        }
        Update: {
          budget_estimate?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          event_date?: string
          event_end_time?: string | null
          event_start_time?: string | null
          event_type?: string | null
          final_amount?: number | null
          guest_count?: number
          id?: string
          menu_selection?: Json | null
          quoted_amount?: number | null
          setup_notes?: string | null
          special_requirements?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
          venue_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_venue_resource_id_fkey"
            columns: ["venue_resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      event_timeline: {
        Row: {
          completed_at: string | null
          created_at: string | null
          event_booking_id: string
          id: string
          milestone_type: string
          notes: string | null
          scheduled_at: string | null
          store_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          event_booking_id: string
          id?: string
          milestone_type: string
          notes?: string | null
          scheduled_at?: string | null
          store_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          event_booking_id?: string
          id?: string
          milestone_type?: string
          notes?: string | null
          scheduled_at?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_timeline_event_booking_id_fkey"
            columns: ["event_booking_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_timeline_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_classes: {
        Row: {
          capacity: number
          class_type: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          instructor_id: string | null
          is_active: boolean
          name: string
          schedule: Json | null
          store_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          class_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          name: string
          schedule?: Json | null
          store_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          class_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          name?: string
          schedule?: Json | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fitness_classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitness_classes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          brand: string | null
          created_at: string
          driver_id: string | null
          id: string
          insurance_expiry: string | null
          mileage: number | null
          model: string | null
          notes: string | null
          plate_number: string
          registration_expiry: string | null
          status: string
          store_id: string
          updated_at: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          insurance_expiry?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          plate_number: string
          registration_expiry?: string | null
          status?: string
          store_id: string
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          insurance_expiry?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          plate_number?: string
          registration_expiry?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_execution_logs: {
        Row: {
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          exit_node_id: string | null
          flow_id: string
          id: string
          nodes_visited: number
          started_at: string
          status: string
          store_id: string
          variables_collected: Json | null
        }
        Insert: {
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          exit_node_id?: string | null
          flow_id: string
          id?: string
          nodes_visited?: number
          started_at?: string
          status?: string
          store_id: string
          variables_collected?: Json | null
        }
        Update: {
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          exit_node_id?: string | null
          flow_id?: string
          id?: string
          nodes_visited?: number
          started_at?: string
          status?: string
          store_id?: string
          variables_collected?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_execution_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_execution_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_execution_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          business_type: string | null
          created_at: string
          description: string | null
          edges: Json
          id: string
          is_template: boolean
          last_triggered_at: string | null
          name: string
          nodes: Json
          priority: number
          status: string
          store_id: string
          times_completed: number
          times_triggered: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
          viewport: Json | null
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_template?: boolean
          last_triggered_at?: string | null
          name: string
          nodes?: Json
          priority?: number
          status?: string
          store_id: string
          times_completed?: number
          times_triggered?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          viewport?: Json | null
        }
        Update: {
          business_type?: string | null
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          is_template?: boolean
          last_triggered_at?: string | null
          name?: string
          nodes?: Json
          priority?: number
          status?: string
          store_id?: string
          times_completed?: number
          times_triggered?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          viewport?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "flows_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string | null
          current_balance: number
          customer_id: string | null
          expires_at: string | null
          id: string
          initial_balance: number
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_balance: number
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          initial_balance: number
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_balance?: number
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          initial_balance?: number
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          assessment_name: string
          created_at: string | null
          enrollment_id: string
          graded_at: string | null
          id: string
          max_score: number | null
          notes: string | null
          score: number | null
          store_id: string
          weight: number | null
        }
        Insert: {
          assessment_name: string
          created_at?: string | null
          enrollment_id: string
          graded_at?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          store_id: string
          weight?: number | null
        }
        Update: {
          assessment_name?: string
          created_at?: string | null
          enrollment_id?: string
          graded_at?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          store_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string | null
          customer_id: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          store_id: string
          updated_at: string | null
          vip_level: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string | null
          vip_level?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
          vip_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          priority: string | null
          scheduled_at: string | null
          status: string | null
          store_id: string
          task_type: string | null
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          scheduled_at?: string | null
          status?: string | null
          store_id: string
          task_type?: string | null
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          scheduled_at?: string | null
          status?: string | null
          store_id?: string
          task_type?: string | null
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          id: string
          inspection_type: string
          inspector_name: string
          notes: string | null
          project_id: string
          required_corrections: string | null
          result: string
          scheduled_date: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_type?: string
          inspector_name: string
          notes?: string | null
          project_id: string
          required_corrections?: string | null
          result?: string
          scheduled_date: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_type?: string
          inspector_name?: string
          notes?: string | null
          project_id?: string
          required_corrections?: string | null
          result?: string
          scheduled_date?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          barcode: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          location_type: string | null
          name: string
          parent_id: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          name: string
          parent_id?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          name?: string
          parent_id?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          store_id: string
          unit_cost: number | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          unit_cost?: number | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          unit_cost?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          discount: number | null
          id: string
          invoice_id: string
          item_id: string | null
          item_type: string | null
          line_total: number | null
          quantity: number | null
          sort_order: number | null
          tax_rate: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          discount?: number | null
          id?: string
          invoice_id: string
          item_id?: string | null
          item_type?: string | null
          line_total?: number | null
          quantity?: number | null
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          discount?: number | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          item_type?: string | null
          line_total?: number | null
          quantity?: number | null
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          metadata: Json | null
          notes: string | null
          party_id: string | null
          party_type: string
          source_id: string | null
          source_type: string | null
          status: string | null
          store_id: string
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          metadata?: Json | null
          notes?: string | null
          party_id?: string | null
          party_type: string
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          store_id: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          metadata?: Json | null
          notes?: string | null
          party_id?: string | null
          party_type?: string
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          store_id?: string
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_stations: {
        Row: {
          created_at: string | null
          display_categories: string[] | null
          id: string
          is_active: boolean | null
          name: string
          station_type: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_categories?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          station_type?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_categories?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          station_type?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_stations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_tickets: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          items: Json | null
          order_id: string | null
          priority: number | null
          started_at: string | null
          station_id: string | null
          status: string | null
          store_id: string
          table_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          order_id?: string | null
          priority?: number | null
          started_at?: string | null
          station_id?: string | null
          status?: string | null
          store_id: string
          table_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          order_id?: string | null
          priority?: number | null
          started_at?: string | null
          station_id?: string | null
          status?: string | null
          store_id?: string
          table_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_tickets_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_tickets_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          collection_time: string | null
          created_at: string | null
          encounter_id: string | null
          id: string
          notes: string | null
          order_type: string | null
          ordered_by: string | null
          patient_id: string
          specimen_type: string | null
          status: string | null
          store_id: string
          test_code: string | null
          test_name: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          collection_time?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          ordered_by?: string | null
          patient_id: string
          specimen_type?: string | null
          status?: string | null
          store_id: string
          test_code?: string | null
          test_name: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          collection_time?: string | null
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          ordered_by?: string | null
          patient_id?: string
          specimen_type?: string | null
          status?: string | null
          store_id?: string
          test_code?: string | null
          test_name?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string | null
          id: string
          interpretation: string | null
          order_id: string
          report_url: string | null
          result_data: Json | null
          resulted_at: string | null
          resulted_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interpretation?: string | null
          order_id: string
          report_url?: string | null
          result_data?: Json | null
          resulted_at?: string | null
          resulted_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interpretation?: string | null
          order_id?: string
          report_url?: string | null
          result_data?: Json | null
          resulted_at?: string | null
          resulted_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_items: {
        Row: {
          created_at: string | null
          id: string
          item_type: string
          notes: string | null
          order_id: string
          quantity: number | null
          service_type: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_type: string
          notes?: string | null
          order_id: string
          quantity?: number | null
          service_type?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_type?: string
          notes?: string | null
          order_id?: string
          quantity?: number | null
          service_type?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "laundry_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          order_number: string
          paid_amount: number | null
          pickup_date: string | null
          rush_order: boolean | null
          status: string | null
          store_id: string
          total_amount: number | null
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          paid_amount?: number | null
          pickup_date?: string | null
          rush_order?: boolean | null
          status?: string | null
          store_id: string
          total_amount?: number | null
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          paid_amount?: number | null
          pickup_date?: string | null
          rush_order?: boolean | null
          status?: string | null
          store_id?: string
          total_amount?: number | null
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string | null
          deposit_amount: number | null
          id: string
          lease_end: string | null
          lease_start: string
          monthly_rent: number
          notes: string | null
          status: string | null
          store_id: string
          tenant_email: string | null
          tenant_name: string
          tenant_phone: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          lease_end?: string | null
          lease_start: string
          monthly_rent: number
          notes?: string | null
          status?: string | null
          store_id: string
          tenant_email?: string | null
          tenant_name: string
          tenant_phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          lease_end?: string | null
          lease_start?: string
          monthly_rent?: number
          notes?: string | null
          status?: string | null
          store_id?: string
          tenant_email?: string | null
          tenant_name?: string
          tenant_phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          amount_paid: number
          assigned_to: string | null
          case_number: string
          case_type: string
          court_name: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          filing_date: string | null
          id: string
          next_hearing: string | null
          notes: string | null
          priority: string
          status: string
          store_id: string
          title: string
          total_fees: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          assigned_to?: string | null
          case_number: string
          case_type?: string
          court_name?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          filing_date?: string | null
          id?: string
          next_hearing?: string | null
          notes?: string | null
          priority?: string
          status?: string
          store_id: string
          title: string
          total_fees?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          assigned_to?: string | null
          case_number?: string
          case_type?: string
          court_name?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          filing_date?: string | null
          id?: string
          next_hearing?: string | null
          notes?: string | null
          priority?: string
          status?: string
          store_id?: string
          title?: string
          total_fees?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_expenses: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          description: string
          expense_type: string
          id: string
          incurred_date: string
          is_billable: boolean
          receipt_url: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          description: string
          expense_type?: string
          id?: string
          incurred_date?: string
          is_billable?: boolean
          receipt_url?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          description?: string
          expense_type?: string
          id?: string
          incurred_date?: string
          is_billable?: boolean
          receipt_url?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          store_id: string
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          store_id: string
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          capacity_kg: number | null
          created_at: string | null
          id: string
          machine_type: string | null
          name: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          capacity_kg?: number | null
          created_at?: string | null
          id?: string
          machine_type?: string | null
          name: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          capacity_kg?: number | null
          created_at?: string | null
          id?: string
          machine_type?: string | null
          name?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          priority: string | null
          reported_by: string | null
          status: string | null
          store_id: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          priority?: string | null
          reported_by?: string | null
          status?: string | null
          store_id: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          priority?: string | null
          reported_by?: string | null
          status?: string | null
          store_id?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      material_orders: {
        Row: {
          created_at: string
          expected_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          project_id: string
          status: string
          store_id: string
          supplier_name: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          project_id: string
          status?: string
          store_id: string
          supplier_name: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          project_id?: string
          status?: string
          store_id?: string
          supplier_name?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_complaints: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string | null
          description: string
          encounter_id: string | null
          id: string
          patient_id: string | null
          resolution: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          encounter_id?: string | null
          id?: string
          patient_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          encounter_id?: string | null
          id?: string
          patient_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_complaints_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_complaints_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_complaints_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          encounter_id: string | null
          id: string
          is_private: boolean | null
          note_type: string | null
          patient_id: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          is_private?: boolean | null
          note_type?: string | null
          patient_id: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          encounter_id?: string | null
          id?: string
          is_private?: boolean | null
          note_type?: string | null
          patient_id?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          benefits: Json | null
          billing_period: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          store_id: string
          updated_at: string | null
        }
        Insert: {
          benefits?: Json | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          store_id: string
          updated_at?: string | null
        }
        Update: {
          benefits?: Json | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          available_from: string | null
          available_until: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_ai_response: boolean | null
          is_from_customer: boolean | null
          metadata: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_ai_response?: boolean | null
          is_from_customer?: boolean | null
          metadata?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_ai_response?: boolean | null
          is_from_customer?: boolean | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
          selection_type: string | null
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          selection_type?: string | null
          sort_order?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          selection_type?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          is_available: boolean | null
          is_default: boolean | null
          name: string
          price_adjustment: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          is_available?: boolean | null
          is_default?: boolean | null
          name: string
          price_adjustment?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          is_available?: boolean | null
          is_default?: boolean | null
          name?: string
          price_adjustment?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          store_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          store_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          store_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          created_at: string | null
          id: string
          modifier_id: string
          order_item_id: string
          price_adjustment: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          modifier_id: string
          order_item_id: string
          price_adjustment?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          modifier_id?: string
          order_item_id?: string
          price_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          shipping_address: string | null
          shipping_amount: number | null
          status: string | null
          store_id: string
          total_amount: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: string | null
          shipping_amount?: number | null
          status?: string | null
          store_id: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          shipping_address?: string | null
          shipping_amount?: number | null
          status?: string | null
          store_id?: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      package_purchases: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          id: string
          package_id: string | null
          purchase_date: string | null
          sessions_total: number
          sessions_used: number | null
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          package_id?: string | null
          purchase_date?: string | null
          sessions_total: number
          sessions_used?: number | null
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          package_id?: string | null
          purchase_date?: string | null
          sessions_total?: number
          sessions_used?: number | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      package_services: {
        Row: {
          id: string
          package_id: string
          quantity: number | null
          service_id: string
        }
        Insert: {
          id?: string
          package_id: string
          quantity?: number | null
          service_id: string
        }
        Update: {
          id?: string
          package_id?: string
          quantity?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_services_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: string[] | null
          blood_type: string | null
          created_at: string | null
          customer_id: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact: Json | null
          first_name: string
          gender: string | null
          id: string
          insurance_info: Json | null
          last_name: string
          medical_history: Json | null
          phone: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          first_name: string
          gender?: string | null
          id?: string
          insurance_info?: Json | null
          last_name: string
          medical_history?: Json | null
          phone?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          allergies?: string[] | null
          blood_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact?: Json | null
          first_name?: string
          gender?: string | null
          id?: string
          insurance_info?: Json | null
          last_name?: string
          medical_history?: Json | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          cost: number | null
          created_at: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          notes: string | null
          permit_number: string | null
          permit_type: string
          project_id: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type?: string
          project_id: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type?: string
          project_id?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_appointments: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          pet_id: string
          scheduled_at: string
          service_id: string | null
          staff_id: string | null
          status: string
          store_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          pet_id: string
          scheduled_at: string
          service_id?: string | null
          staff_id?: string | null
          status?: string
          store_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          pet_id?: string
          scheduled_at?: string
          service_id?: string | null
          staff_id?: string | null
          status?: string
          store_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_appointments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          breed: string | null
          created_at: string
          customer_id: string | null
          date_of_birth: string | null
          id: string
          is_active: boolean
          medical_notes: string | null
          name: string
          species: string
          store_id: string
          updated_at: string
          vaccinations: Json | null
          weight: number | null
        }
        Insert: {
          breed?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          id?: string
          is_active?: boolean
          medical_notes?: string | null
          name: string
          species?: string
          store_id: string
          updated_at?: string
          vaccinations?: Json | null
          weight?: number | null
        }
        Update: {
          breed?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          id?: string
          is_active?: boolean
          medical_notes?: string | null
          name?: string
          species?: string
          store_id?: string
          updated_at?: string
          vaccinations?: Json | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_galleries: {
        Row: {
          created_at: string
          delivered_at: string | null
          description: string | null
          download_url: string | null
          gallery_url: string | null
          id: string
          name: string
          password: string | null
          photo_count: number
          session_id: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          description?: string | null
          download_url?: string | null
          gallery_url?: string | null
          id?: string
          name: string
          password?: string | null
          photo_count?: number
          session_id: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          description?: string | null
          download_url?: string | null
          gallery_url?: string | null
          id?: string
          name?: string
          password?: string | null
          photo_count?: number
          session_id?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_galleries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "photo_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_galleries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_sessions: {
        Row: {
          created_at: string
          customer_id: string | null
          deposit_amount: number | null
          duration_minutes: number
          id: string
          location: string | null
          notes: string | null
          photographer_id: string | null
          scheduled_at: string
          session_type: string
          status: string
          store_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          photographer_id?: string | null
          scheduled_at: string
          session_type?: string
          status?: string
          store_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          duration_minutes?: number
          id?: string
          location?: string | null
          notes?: string | null
          photographer_id?: string | null
          scheduled_at?: string
          session_type?: string
          status?: string
          store_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_sessions_photographer_id_fkey"
            columns: ["photographer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string | null
          id: string
          opened_at: string | null
          opened_by: string
          opening_cash: number | null
          register_name: string | null
          status: string | null
          store_id: string
          total_sales: number | null
          total_transactions: number | null
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          opened_by: string
          opening_cash?: number | null
          register_name?: string | null
          status?: string | null
          store_id: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          opened_by?: string
          opening_cash?: number | null
          register_name?: string | null
          status?: string | null
          store_id?: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          created_at: string | null
          dosage: string
          duration: string | null
          frequency: string
          id: string
          instructions: string | null
          medication_name: string
          prescription_id: string
        }
        Insert: {
          created_at?: string | null
          dosage: string
          duration?: string | null
          frequency: string
          id?: string
          instructions?: string | null
          medication_name: string
          prescription_id: string
        }
        Update: {
          created_at?: string | null
          dosage?: string
          duration?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          medication_name?: string
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          encounter_id: string | null
          id: string
          notes: string | null
          patient_id: string
          prescribed_by: string | null
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          prescribed_by?: string | null
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          prescribed_by?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_dispensed_by_fkey"
            columns: ["dispensed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_prescribed_by_fkey"
            columns: ["prescribed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_groups: {
        Row: {
          id: string
          modifier_group_id: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          modifier_group_id: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          modifier_group_id?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_groups_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          price: number | null
          product_id: string
          size: string | null
          sku: string | null
          stock_quantity: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          product_id: string
          size?: string | null
          sku?: string | null
          stock_quantity?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          product_id?: string
          size?: string | null
          sku?: string | null
          stock_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          assigned_to: string | null
          cost_per_unit: number | null
          created_at: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          produced_qty: number | null
          product_id: string | null
          production_date: string
          status: string | null
          store_id: string
          target_qty: number
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          produced_qty?: number | null
          product_id?: string | null
          production_date: string
          status?: string | null
          store_id: string
          target_qty: number
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          produced_qty?: number | null
          product_id?: string | null
          production_date?: string
          status?: string | null
          store_id?: string
          target_qty?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_context: string | null
          base_price: number | null
          category: string | null
          created_at: string | null
          description: string | null
          facebook_post_id: string | null
          has_variants: boolean | null
          id: string
          images: Json | null
          instagram_post_id: string | null
          menu_category_id: string | null
          name: string
          sales_script: string | null
          search_aliases: string[] | null
          sku: string | null
          status: string | null
          store_id: string
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          ai_context?: string | null
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          facebook_post_id?: string | null
          has_variants?: boolean | null
          id?: string
          images?: Json | null
          instagram_post_id?: string | null
          menu_category_id?: string | null
          name: string
          sales_script?: string | null
          search_aliases?: string[] | null
          sku?: string | null
          status?: string | null
          store_id: string
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_context?: string | null
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          facebook_post_id?: string | null
          has_variants?: boolean | null
          id?: string
          images?: Json | null
          instagram_post_id?: string | null
          menu_category_id?: string | null
          name?: string
          sales_script?: string | null
          search_aliases?: string[] | null
          sku?: string | null
          status?: string | null
          store_id?: string
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_menu_category_id_fkey"
            columns: ["menu_category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          description: string | null
          duration_weeks: number | null
          id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          price: number | null
          program_type: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          price?: number | null
          program_type?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          price?: number | null
          program_type?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          priority: string
          project_id: string
          sort_order: number
          status: string
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          project_id: string
          sort_order?: number
          status?: string
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          priority?: string
          project_id?: string
          sort_order?: number
          status?: string
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number
          budget: number | null
          completion_percentage: number
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          manager_id: string | null
          name: string
          notes: string | null
          priority: string
          project_type: string
          start_date: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number
          budget?: number | null
          completion_percentage?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name: string
          notes?: string | null
          priority?: string
          project_type?: string
          start_date?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number
          budget?: number | null
          completion_percentage?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name?: string
          notes?: string | null
          priority?: string
          project_type?: string
          start_date?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applicable_categories: string[] | null
          applicable_products: string[] | null
          conditions: Json | null
          created_at: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          max_usage: number | null
          min_order_amount: number | null
          name: string
          promo_type: string
          start_date: string | null
          store_id: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_usage?: number | null
          min_order_amount?: number | null
          name: string
          promo_type: string
          start_date?: string | null
          store_id: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_usage?: number | null
          min_order_amount?: number | null
          name?: string
          promo_type?: string
          start_date?: string | null
          store_id?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number | null
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantity_ordered?: number
          quantity_received?: number | null
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          expected_date: string | null
          id: string
          notes: string | null
          po_number: string
          received_date: string | null
          status: string | null
          store_id: string
          supplier_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          received_date?: string | null
          status?: string | null
          store_id: string
          supplier_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          received_date?: string | null
          status?: string | null
          store_id?: string
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rack_locations: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          rack_number: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          rack_number: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          rack_number?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rack_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rack_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plans: {
        Row: {
          base_price: number
          created_at: string | null
          id: string
          is_active: boolean | null
          max_stay: number | null
          min_stay: number | null
          name: string
          pricing_model: string | null
          seasonal_adjustments: Json | null
          store_id: string
          unit_type: string | null
          updated_at: string | null
          weekend_price: number | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_stay?: number | null
          min_stay?: number | null
          name: string
          pricing_model?: string | null
          seasonal_adjustments?: Json | null
          store_id: string
          unit_type?: string | null
          updated_at?: string | null
          weekend_price?: number | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_stay?: number | null
          min_stay?: number | null
          name?: string
          pricing_model?: string | null
          seasonal_adjustments?: Json | null
          store_id?: string
          unit_type?: string | null
          updated_at?: string | null
          weekend_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          brand: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          deposit_amount: number | null
          device_type: string
          diagnosis: string | null
          estimated_completion: string | null
          estimated_cost: number | null
          id: string
          issue_description: string
          model: string | null
          notes: string | null
          order_number: string
          priority: string
          received_at: string
          serial_number: string | null
          status: string
          store_id: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          brand?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          deposit_amount?: number | null
          device_type?: string
          diagnosis?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          issue_description: string
          model?: string | null
          notes?: string | null
          order_number: string
          priority?: string
          received_at?: string
          serial_number?: string | null
          status?: string
          store_id: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          brand?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          deposit_amount?: number | null
          device_type?: string
          diagnosis?: string | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          id?: string
          issue_description?: string
          model?: string | null
          notes?: string | null
          order_number?: string
          priority?: string
          received_at?: string
          serial_number?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          created_at: string
          id: string
          name: string
          part_number: string | null
          quantity: number
          repair_order_id: string
          store_id: string
          supplier: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          part_number?: string | null
          quantity?: number
          repair_order_id: string
          store_id: string
          supplier?: string | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          part_number?: string | null
          quantity?: number
          repair_order_id?: string
          store_id?: string
          supplier?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          actual_check_in: string | null
          actual_check_out: string | null
          adults: number | null
          check_in: string
          check_out: string
          children: number | null
          created_at: string | null
          deposit_amount: number | null
          deposit_status: string | null
          guest_id: string
          id: string
          rate_per_night: number
          source: string | null
          special_requests: string | null
          status: string | null
          store_id: string
          total_amount: number
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          adults?: number | null
          check_in: string
          check_out: string
          children?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          guest_id: string
          id?: string
          rate_per_night: number
          source?: string | null
          special_requests?: string | null
          status?: string | null
          store_id: string
          total_amount: number
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          adults?: number | null
          check_in?: string
          check_out?: string
          children?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          guest_id?: string
          id?: string
          rate_per_night?: number
          source?: string | null
          special_requests?: string | null
          status?: string | null
          store_id?: string
          total_amount?: number
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      retainers: {
        Row: {
          case_id: string
          client_id: string | null
          created_at: string
          current_balance: number
          id: string
          initial_amount: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          client_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_amount?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          client_id?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_amount?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string | null
          id: string
          order_item_id: string
          product_id: string | null
          quantity: number
          reason: string | null
          return_id: string
          subtotal: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_item_id: string
          product_id?: string | null
          quantity?: number
          reason?: string | null
          return_id: string
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_item_id?: string
          product_id?: string | null
          quantity?: number
          reason?: string | null
          return_id?: string
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          handled_by: string | null
          handled_by_user_id: string | null
          id: string
          order_id: string
          reason: string | null
          refund_amount: number
          refund_method: string | null
          rejected_at: string | null
          return_number: string
          return_type: string
          status: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          handled_by?: string | null
          handled_by_user_id?: string | null
          id?: string
          order_id: string
          reason?: string | null
          refund_amount?: number
          refund_method?: string | null
          rejected_at?: string | null
          return_number: string
          return_type?: string
          status?: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          handled_by?: string | null
          handled_by_user_id?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          refund_amount?: number
          refund_method?: string | null
          rejected_at?: string | null
          return_number?: string
          return_type?: string
          status?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_handled_by_user_id_fkey"
            columns: ["handled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
          zip_codes: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
          zip_codes?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
          zip_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          original_price: number | null
          price: number
          store_id: string
          updated_at: string | null
          valid_days: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          original_price?: number | null
          price: number
          store_id: string
          updated_at?: string | null
          valid_days?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          store_id?: string
          updated_at?: string | null
          valid_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          actual_cost: number | null
          address: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          duration_estimate: number | null
          estimated_cost: number | null
          id: string
          notes: string | null
          priority: string
          request_number: string
          scheduled_at: string | null
          service_type: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          address?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          duration_estimate?: number | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          request_number: string
          scheduled_at?: string | null
          service_type?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          address?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          duration_estimate?: number | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          priority?: string
          request_number?: string
          scheduled_at?: string | null
          service_type?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variations: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_addon: boolean | null
          name: string
          price: number | null
          service_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_addon?: boolean | null
          name: string
          price?: number | null
          service_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_addon?: boolean | null
          name?: string
          price?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          ai_context: string | null
          base_price: number | null
          category: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          facebook_post_id: string | null
          id: string
          images: Json | null
          instagram_post_id: string | null
          name: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          ai_context?: string | null
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          facebook_post_id?: string | null
          id?: string
          images?: Json | null
          instagram_post_id?: string | null
          name: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          ai_context?: string | null
          base_price?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          facebook_post_id?: string | null
          id?: string
          images?: Json | null
          instagram_post_id?: string | null
          name?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          messenger_psid: string | null
          name: string
          phone: string | null
          specialties: string[] | null
          status: string | null
          store_id: string
          telegram_chat_id: string | null
          updated_at: string | null
          user_id: string | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          messenger_psid?: string | null
          name: string
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          store_id: string
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          messenger_psid?: string | null
          name?: string
          phone?: string | null
          specialties?: string[] | null
          status?: string | null
          store_id?: string
          telegram_chat_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_commissions: {
        Row: {
          appointment_id: string | null
          commission_amount: number
          commission_rate: number
          created_at: string | null
          id: string
          paid_at: string | null
          sale_amount: number
          sale_type: string | null
          staff_id: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          commission_amount: number
          commission_rate: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          sale_amount: number
          sale_type?: string | null
          staff_id: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          sale_amount?: number
          sale_type?: string | null
          staff_id?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_commissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string | null
          from_location_id: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          status: string | null
          store_id: string
          to_location_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          from_location_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string | null
          store_id: string
          to_location_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          from_location_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          status?: string | null
          store_id?: string
          to_location_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_closures: {
        Row: {
          created_at: string | null
          date: string
          id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          reason?: string | null
          store_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_closures_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          close_time: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          store_id: string
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          store_id: string
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          messages_used: number | null
          plan_id: string
          status: string | null
          store_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          messages_used?: number | null
          plan_id: string
          status?: string | null
          store_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          messages_used?: number | null
          plan_id?: string
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          ai_auto_reply: boolean | null
          api_key: string | null
          business_type: string | null
          chatbot_settings: Json | null
          created_at: string | null
          delivery_settings: Json | null
          delivery_time_slots: Json | null
          description: string | null
          email: string | null
          enabled_modules: Json | null
          facebook_connected_at: string | null
          facebook_page_access_token: string | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          id: string
          instagram_business_account_id: string | null
          instagram_connected_at: string | null
          instagram_page_name: string | null
          logo_url: string | null
          name: string
          owner_id: string
          payment_settings: Json | null
          phone: string | null
          product_settings: Json | null
          shipping_settings: Json | null
          slug: string
          updated_at: string | null
          webhook_events: Json | null
          webhook_secret: string | null
          webhook_url: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_auto_reply?: boolean | null
          api_key?: string | null
          business_type?: string | null
          chatbot_settings?: Json | null
          created_at?: string | null
          delivery_settings?: Json | null
          delivery_time_slots?: Json | null
          description?: string | null
          email?: string | null
          enabled_modules?: Json | null
          facebook_connected_at?: string | null
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          instagram_business_account_id?: string | null
          instagram_connected_at?: string | null
          instagram_page_name?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          payment_settings?: Json | null
          phone?: string | null
          product_settings?: Json | null
          shipping_settings?: Json | null
          slug: string
          updated_at?: string | null
          webhook_events?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_auto_reply?: boolean | null
          api_key?: string | null
          business_type?: string | null
          chatbot_settings?: Json | null
          created_at?: string | null
          delivery_settings?: Json | null
          delivery_time_slots?: Json | null
          description?: string | null
          email?: string | null
          enabled_modules?: Json | null
          facebook_connected_at?: string | null
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          instagram_business_account_id?: string | null
          instagram_connected_at?: string | null
          instagram_page_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          payment_settings?: Json | null
          phone?: string | null
          product_settings?: Json | null
          shipping_settings?: Json | null
          slug?: string
          updated_at?: string | null
          webhook_events?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          customer_id: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_items: {
        Row: {
          created_at: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          service_id: string | null
          store_id: string
          subscription_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          store_id: string
          subscription_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          store_id?: string
          subscription_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          id: string
          limits: Json
          name: string
          price: number | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          limits: Json
          name: string
          price?: number | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          limits?: Json
          name?: string
          price?: number | null
          slug?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean
          billing_period: string
          cancelled_at: string | null
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          next_billing_at: string | null
          notes: string | null
          plan_name: string
          started_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          auto_renew?: boolean
          billing_period?: string
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          next_billing_at?: string | null
          notes?: string | null
          plan_name: string
          started_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean
          billing_period?: string
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          next_billing_at?: string | null
          notes?: string | null
          plan_name?: string
          started_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: string | null
          phone: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      table_layouts: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          position_x: number | null
          position_y: number | null
          section: string | null
          shape: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position_x?: number | null
          position_y?: number | null
          section?: string | null
          shape?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position_x?: number | null
          position_y?: number | null
          section?: string | null
          shape?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_layouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      table_reservations: {
        Row: {
          created_at: string
          customer_id: string | null
          duration_minutes: number
          id: string
          notes: string | null
          party_size: number
          reservation_time: string
          status: string
          store_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          party_size?: number
          reservation_time: string
          status?: string
          store_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          party_size?: number
          reservation_time?: string
          status?: string
          store_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string | null
          guest_count: number
          id: string
          notes: string | null
          seated_at: string | null
          server_id: string | null
          status: string | null
          store_id: string
          table_id: string
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          guest_count?: number
          id?: string
          notes?: string | null
          seated_at?: string | null
          server_id?: string | null
          status?: string | null
          store_id: string
          table_id: string
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          guest_count?: number
          id?: string
          notes?: string | null
          seated_at?: string | null
          server_id?: string | null
          status?: string | null
          store_id?: string
          table_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable_rate: number
          case_id: string
          created_at: string
          description: string
          entry_date: string
          hours: number
          id: string
          is_billable: boolean
          staff_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          billable_rate?: number
          case_id: string
          created_at?: string
          description: string
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          staff_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          billable_rate?: number
          case_id?: string
          created_at?: string
          description?: string
          entry_date?: string
          hours?: number
          id?: string
          is_billable?: boolean
          staff_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
          received_quantity: number | null
          transfer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity: number
          received_quantity?: number | null
          transfer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          received_quantity?: number | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          sessions_total: number
          sessions_used: number
          start_date: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          sessions_total?: number
          sessions_used?: number
          start_date?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          sessions_total?: number
          sessions_used?: number
          start_date?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string | null
          results: string | null
          session_number: number
          status: string
          store_id: string
          treatment_plan_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          results?: string | null
          session_number?: number
          status?: string
          store_id: string
          treatment_plan_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          results?: string | null
          session_number?: number
          status?: string
          store_id?: string
          treatment_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_logs: {
        Row: {
          created_at: string
          distance_km: number | null
          driver_id: string | null
          end_location: string | null
          end_time: string | null
          fuel_cost: number | null
          id: string
          notes: string | null
          start_location: string | null
          start_time: string
          status: string
          store_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          end_location?: string | null
          end_time?: string | null
          fuel_cost?: number | null
          id?: string
          notes?: string | null
          start_location?: string | null
          start_time: string
          status?: string
          store_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          end_location?: string | null
          end_time?: string | null
          fuel_cost?: number | null
          id?: string
          notes?: string | null
          start_location?: string | null
          start_time?: string
          status?: string
          store_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          amenities: Json | null
          base_rate: number
          created_at: string | null
          floor: string | null
          id: string
          images: Json | null
          max_occupancy: number | null
          resource_id: string | null
          status: string | null
          store_id: string
          unit_number: string
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          amenities?: Json | null
          base_rate: number
          created_at?: string | null
          floor?: string | null
          id?: string
          images?: Json | null
          max_occupancy?: number | null
          resource_id?: string | null
          status?: string | null
          store_id: string
          unit_number: string
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amenities?: Json | null
          base_rate?: number
          created_at?: string | null
          floor?: string | null
          id?: string
          images?: Json | null
          max_occupancy?: number | null
          resource_id?: string | null
          status?: string | null
          store_id?: string
          unit_number?: string
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          email_verified: boolean | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          notification_settings: Json | null
          password_hash: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          notification_settings?: Json | null
          password_hash?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          notification_settings?: Json | null
          password_hash?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          customer_id: string | null
          id: string
          make: string | null
          model: string | null
          notes: string | null
          plate_number: string
          store_id: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          plate_number: string
          store_id: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          plate_number?: string
          store_id?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_bookings: {
        Row: {
          created_at: string
          customer_id: string | null
          deposit_amount: number | null
          end_at: string
          event_type: string
          guests_count: number | null
          id: string
          special_requests: string | null
          start_at: string
          status: string
          store_id: string
          total_amount: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          end_at: string
          event_type?: string
          guests_count?: number | null
          id?: string
          special_requests?: string | null
          start_at: string
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          end_at?: string
          event_type?: string
          guests_count?: number | null
          id?: string
          special_requests?: string | null
          start_at?: string
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          amenities: Json | null
          capacity: number
          created_at: string
          daily_rate: number | null
          description: string | null
          hourly_rate: number | null
          id: string
          images: Json | null
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          amenities?: Json | null
          capacity?: number
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          images?: Json | null
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          amenities?: Json | null
          capacity?: number
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          hourly_rate?: number | null
          id?: string
          images?: Json | null
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          admin_notes: string | null
          approved_by: string | null
          approved_by_user_id: string | null
          compensation_type: string
          compensation_value: number
          complaint_category: string | null
          complaint_summary: string | null
          conversation_id: string | null
          created_at: string
          customer_id: string
          id: string
          max_discount_amount: number | null
          policy_id: string | null
          redeemed_at: string | null
          redeemed_order_id: string | null
          status: string
          store_id: string
          updated_at: string
          valid_until: string
          voucher_code: string
        }
        Insert: {
          admin_notes?: string | null
          approved_by?: string | null
          approved_by_user_id?: string | null
          compensation_type: string
          compensation_value?: number
          complaint_category?: string | null
          complaint_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          max_discount_amount?: number | null
          policy_id?: string | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
          valid_until: string
          voucher_code: string
        }
        Update: {
          admin_notes?: string | null
          approved_by?: string | null
          approved_by_user_id?: string | null
          compensation_type?: string
          compensation_value?: number
          complaint_category?: string | null
          complaint_summary?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          max_discount_amount?: number | null
          policy_id?: string | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
          valid_until?: string
          voucher_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "compensation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wash_orders: {
        Row: {
          bay_number: number | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          order_number: string
          service_type: string
          started_at: string | null
          status: string
          store_id: string
          total_amount: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          bay_number?: number | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          service_type?: string
          started_at?: string | null
          status?: string
          store_id: string
          total_amount?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          bay_number?: number | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          service_type?: string
          started_at?: string | null
          status?: string
          store_id?: string
          total_amount?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wash_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wash_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disconnect_facebook_connection: { Args: { payload: Json }; Returns: Json }
      disconnect_instagram_connection: {
        Args: { payload: Json }
        Returns: Json
      }
      increment_flow_stats: {
        Args: {
          p_flow_id: string
          p_increment_completed?: number
          p_increment_triggered?: number
        }
        Returns: undefined
      }
      increment_rule_stats: {
        Args: {
          p_increment_matches?: number
          p_increment_replies?: number
          p_rule_id: string
        }
        Returns: undefined
      }
      is_store_owner: { Args: { p_store_id: string }; Returns: boolean }
      save_facebook_connection: { Args: { payload: Json }; Returns: Json }
      save_instagram_connection: { Args: { payload: Json }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
