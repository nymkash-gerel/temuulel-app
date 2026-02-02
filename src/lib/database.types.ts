export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          full_name: string | null
          password_hash: string
          is_verified: boolean
          email_verified: boolean
          role: string
          notification_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          phone?: string | null
          full_name?: string | null
          password_hash?: string
          is_verified?: boolean
          email_verified?: boolean
          role?: string
          notification_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          full_name?: string | null
          password_hash?: string
          is_verified?: boolean
          email_verified?: boolean
          role?: string
          notification_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          slug: string
          name: string
          price: number
          limits: Json
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          price?: number
          limits: Json
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          price?: number
          limits?: Json
          created_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          description: string | null
          phone: string | null
          email: string | null
          address: string | null
          business_type: string | null
          logo_url: string | null
          website: string | null
          facebook_page_id: string | null
          facebook_page_access_token: string | null
          facebook_page_name: string | null
          facebook_connected_at: string | null
          instagram_business_account_id: string | null
          instagram_page_name: string | null
          instagram_connected_at: string | null
          ai_auto_reply: boolean
          chatbot_settings: Json
          product_settings: Json
          payment_settings: Json
          shipping_settings: Json
          delivery_settings: Json
          api_key: string | null
          webhook_url: string | null
          webhook_secret: string | null
          webhook_events: Json
          delivery_time_slots: Json
          enabled_modules: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          description?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          business_type?: string | null
          logo_url?: string | null
          website?: string | null
          facebook_page_id?: string | null
          facebook_page_access_token?: string | null
          facebook_page_name?: string | null
          facebook_connected_at?: string | null
          instagram_business_account_id?: string | null
          instagram_page_name?: string | null
          instagram_connected_at?: string | null
          ai_auto_reply?: boolean
          chatbot_settings?: Json
          product_settings?: Json
          payment_settings?: Json
          shipping_settings?: Json
          delivery_settings?: Json
          api_key?: string | null
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_events?: Json
          delivery_time_slots?: Json
          enabled_modules?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          description?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          business_type?: string | null
          logo_url?: string | null
          website?: string | null
          facebook_page_id?: string | null
          facebook_page_access_token?: string | null
          facebook_page_name?: string | null
          facebook_connected_at?: string | null
          instagram_business_account_id?: string | null
          instagram_page_name?: string | null
          instagram_connected_at?: string | null
          ai_auto_reply?: boolean
          chatbot_settings?: Json
          product_settings?: Json
          payment_settings?: Json
          shipping_settings?: Json
          delivery_settings?: Json
          api_key?: string | null
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_events?: Json
          delivery_time_slots?: Json
          enabled_modules?: Json | null
          created_at?: string
          updated_at?: string
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
      store_subscriptions: {
        Row: {
          id: string
          store_id: string
          plan_id: string
          status: string
          messages_used: number
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          plan_id: string
          status?: string
          messages_used?: number
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          plan_id?: string
          status?: string
          messages_used?: number
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          id: string
          store_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string
          role?: string
          created_at?: string
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
      products: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          category: string | null
          subcategory: string | null
          base_price: number
          sku: string | null
          images: Json
          status: string
          has_variants: boolean
          sales_script: string | null
          search_aliases: string[]
          product_faqs: Json
          facebook_post_id: string | null
          instagram_post_id: string | null
          ai_context: string | null
          menu_category_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          category?: string | null
          subcategory?: string | null
          base_price?: number
          sku?: string | null
          images?: Json
          status?: string
          has_variants?: boolean
          sales_script?: string | null
          search_aliases?: string[]
          product_faqs?: Json
          facebook_post_id?: string | null
          instagram_post_id?: string | null
          ai_context?: string | null
          menu_category_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          category?: string | null
          subcategory?: string | null
          base_price?: number
          sku?: string | null
          images?: Json
          status?: string
          has_variants?: boolean
          sales_script?: string | null
          search_aliases?: string[]
          product_faqs?: Json
          facebook_post_id?: string | null
          instagram_post_id?: string | null
          ai_context?: string | null
          menu_category_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          size: string | null
          color: string | null
          price: number
          stock_quantity: number
          sku: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size?: string | null
          color?: string | null
          price?: number
          stock_quantity?: number
          sku?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size?: string | null
          color?: string | null
          price?: number
          stock_quantity?: number
          sku?: string | null
          created_at?: string
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
      customers: {
        Row: {
          id: string
          store_id: string
          name: string | null
          phone: string | null
          email: string | null
          messenger_id: string | null
          instagram_id: string | null
          whatsapp_id: string | null
          channel: string
          address: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name?: string | null
          phone?: string | null
          email?: string | null
          messenger_id?: string | null
          instagram_id?: string | null
          whatsapp_id?: string | null
          channel?: string
          address?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          messenger_id?: string | null
          instagram_id?: string | null
          whatsapp_id?: string | null
          channel?: string
          address?: string | null
          notes?: string | null
          created_at?: string
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
      orders: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          order_number: string
          status: string
          total_amount: number
          shipping_amount: number
          payment_method: string | null
          payment_status: string
          tracking_number: string | null
          shipping_address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          order_number: string
          status?: string
          total_amount?: number
          shipping_amount?: number
          payment_method?: string | null
          payment_status?: string
          tracking_number?: string | null
          shipping_address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          order_number?: string
          status?: string
          total_amount?: number
          shipping_amount?: number
          payment_method?: string | null
          payment_status?: string
          tracking_number?: string | null
          shipping_address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          quantity: number
          unit_price: number
          variant_label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          variant_id?: string | null
          quantity?: number
          unit_price: number
          variant_label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          variant_id?: string | null
          quantity?: number
          unit_price?: number
          variant_label?: string | null
          created_at?: string
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
      conversations: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          status: string
          channel: string
          unread_count: number
          escalation_score: number
          escalation_level: string
          escalated_at: string | null
          assigned_to: string | null
          metadata: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          status?: string
          channel?: string
          unread_count?: number
          escalation_score?: number
          escalation_level?: string
          escalated_at?: string | null
          assigned_to?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          status?: string
          channel?: string
          unread_count?: number
          escalation_score?: number
          escalation_level?: string
          escalated_at?: string | null
          assigned_to?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          content: string
          is_from_customer: boolean
          is_ai_response: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          content: string
          is_from_customer?: boolean
          is_ai_response?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          content?: string
          is_from_customer?: boolean
          is_ai_response?: boolean
          metadata?: Json
          created_at?: string
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
      notifications: {
        Row: {
          id: string
          store_id: string
          type: string
          title: string
          body: string | null
          data: Json
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          type: string
          title: string
          body?: string | null
          data?: Json
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Json
          is_read?: boolean
          created_at?: string
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
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          id: string
          facebook_sender_id: string
          store_id: string
          created_at: string
        }
        Insert: {
          id?: string
          facebook_sender_id: string
          store_id: string
          created_at?: string
        }
        Update: {
          id?: string
          facebook_sender_id?: string
          store_id?: string
          created_at?: string
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
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: string
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: string
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: string
          content?: string
          metadata?: Json
          created_at?: string
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
      comment_auto_rules: {
        Row: {
          id: string
          store_id: string
          name: string
          enabled: boolean
          priority: number
          trigger_type: 'keyword' | 'any' | 'first_comment' | 'contains_question'
          keywords: string[] | null
          match_mode: 'any' | 'all'
          reply_comment: boolean
          reply_dm: boolean
          comment_template: string | null
          dm_template: string | null
          delay_seconds: number
          platforms: string[]
          post_filter: Json | null
          matches_count: number
          replies_sent: number
          last_triggered_at: string | null
          created_at: string
          updated_at: string
          use_ai: boolean
          ai_context: string | null
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          enabled?: boolean
          priority?: number
          trigger_type?: 'keyword' | 'any' | 'first_comment' | 'contains_question'
          keywords?: string[] | null
          match_mode?: 'any' | 'all'
          reply_comment?: boolean
          reply_dm?: boolean
          comment_template?: string | null
          dm_template?: string | null
          delay_seconds?: number
          platforms?: string[]
          post_filter?: Json | null
          matches_count?: number
          replies_sent?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
          use_ai?: boolean
          ai_context?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          enabled?: boolean
          priority?: number
          trigger_type?: 'keyword' | 'any' | 'first_comment' | 'contains_question'
          keywords?: string[] | null
          match_mode?: 'any' | 'all'
          reply_comment?: boolean
          reply_dm?: boolean
          comment_template?: string | null
          dm_template?: string | null
          delay_seconds?: number
          platforms?: string[]
          post_filter?: Json | null
          matches_count?: number
          replies_sent?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
          use_ai?: boolean
          ai_context?: string | null
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
          id: string
          store_id: string
          rule_id: string | null
          comment_id: string
          post_id: string
          platform: 'facebook' | 'instagram'
          commenter_id: string
          commenter_name: string | null
          comment_text: string | null
          reply_type: 'comment' | 'dm' | 'both'
          reply_comment_id: string | null
          reply_dm_sent: boolean
          status: 'success' | 'failed' | 'skipped'
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          rule_id?: string | null
          comment_id: string
          post_id: string
          platform: 'facebook' | 'instagram'
          commenter_id: string
          commenter_name?: string | null
          comment_text?: string | null
          reply_type: 'comment' | 'dm' | 'both'
          reply_comment_id?: string | null
          reply_dm_sent?: boolean
          status?: 'success' | 'failed' | 'skipped'
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          rule_id?: string | null
          comment_id?: string
          post_id?: string
          platform?: 'facebook' | 'instagram'
          commenter_id?: string
          commenter_name?: string | null
          comment_text?: string | null
          reply_type?: 'comment' | 'dm' | 'both'
          reply_comment_id?: string | null
          reply_dm_sent?: boolean
          status?: 'success' | 'failed' | 'skipped'
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reply_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reply_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "comment_auto_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      // ============================================
      // SERVICES & APPOINTMENTS (Beauty Salon, Spa)
      // ============================================
      services: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          category: string | null
          duration_minutes: number
          base_price: number
          images: Json
          status: 'active' | 'draft' | 'archived'
          ai_context: string | null
          facebook_post_id: string | null
          instagram_post_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          category?: string | null
          duration_minutes?: number
          base_price?: number
          images?: Json
          status?: 'active' | 'draft' | 'archived'
          ai_context?: string | null
          facebook_post_id?: string | null
          instagram_post_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          category?: string | null
          duration_minutes?: number
          base_price?: number
          images?: Json
          status?: 'active' | 'draft' | 'archived'
          ai_context?: string | null
          facebook_post_id?: string | null
          instagram_post_id?: string | null
          created_at?: string
          updated_at?: string
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
      service_variations: {
        Row: {
          id: string
          service_id: string
          name: string
          description: string | null
          price: number
          duration_minutes: number | null
          is_addon: boolean
          created_at: string
        }
        Insert: {
          id?: string
          service_id: string
          name: string
          description?: string | null
          price?: number
          duration_minutes?: number | null
          is_addon?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          name?: string
          description?: string | null
          price?: number
          duration_minutes?: number | null
          is_addon?: boolean
          created_at?: string
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
      staff: {
        Row: {
          id: string
          store_id: string
          user_id: string | null
          name: string
          phone: string | null
          email: string | null
          avatar_url: string | null
          specialties: string[] | null
          working_hours: Json
          telegram_chat_id: string | null
          messenger_psid: string | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id?: string | null
          name: string
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          specialties?: string[] | null
          working_hours?: Json
          telegram_chat_id?: string | null
          messenger_psid?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          avatar_url?: string | null
          specialties?: string[] | null
          working_hours?: Json
          telegram_chat_id?: string | null
          messenger_psid?: string | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
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
      appointments: {
        Row: {
          id: string
          store_id: string
          customer_id: string | null
          staff_id: string | null
          service_id: string | null
          variation_id: string | null
          resource_id: string | null
          scheduled_at: string
          duration_minutes: number
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          total_amount: number
          payment_status: 'paid' | 'pending' | 'refunded' | 'partial'
          payment_method: 'qpay' | 'bank' | 'cash' | 'card' | null
          customer_name: string | null
          customer_phone: string | null
          notes: string | null
          internal_notes: string | null
          source: 'manual' | 'chat' | 'messenger' | 'instagram' | 'website'
          conversation_id: string | null
          check_in_date: string | null
          check_out_date: string | null
          party_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          customer_id?: string | null
          staff_id?: string | null
          service_id?: string | null
          variation_id?: string | null
          resource_id?: string | null
          scheduled_at: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          total_amount?: number
          payment_status?: 'paid' | 'pending' | 'refunded' | 'partial'
          payment_method?: 'qpay' | 'bank' | 'cash' | 'card' | null
          customer_name?: string | null
          customer_phone?: string | null
          notes?: string | null
          internal_notes?: string | null
          source?: 'manual' | 'chat' | 'messenger' | 'instagram' | 'website'
          conversation_id?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          party_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string | null
          staff_id?: string | null
          service_id?: string | null
          variation_id?: string | null
          resource_id?: string | null
          scheduled_at?: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          total_amount?: number
          payment_status?: 'paid' | 'pending' | 'refunded' | 'partial'
          payment_method?: 'qpay' | 'bank' | 'cash' | 'card' | null
          customer_name?: string | null
          customer_phone?: string | null
          notes?: string | null
          internal_notes?: string | null
          source?: 'manual' | 'chat' | 'messenger' | 'instagram' | 'website'
          conversation_id?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          party_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "bookable_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_addons: {
        Row: {
          id: string
          appointment_id: string
          service_id: string | null
          variation_id: string | null
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          service_id?: string | null
          variation_id?: string | null
          price?: number
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          service_id?: string | null
          variation_id?: string | null
          price?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_addons_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          id: string
          store_id: string
          day_of_week: number
          open_time: string | null
          close_time: string | null
          is_closed: boolean
        }
        Insert: {
          id?: string
          store_id: string
          day_of_week: number
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
        }
        Update: {
          id?: string
          store_id?: string
          day_of_week?: number
          open_time?: string | null
          close_time?: string | null
          is_closed?: boolean
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
      store_closures: {
        Row: {
          id: string
          store_id: string
          date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          date?: string
          reason?: string | null
          created_at?: string
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
      flows: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          status: string
          is_template: boolean
          business_type: string | null
          trigger_type: string
          trigger_config: Json
          nodes: Json
          edges: Json
          viewport: Json
          priority: number
          times_triggered: number
          times_completed: number
          last_triggered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          status?: string
          is_template?: boolean
          business_type?: string | null
          trigger_type?: string
          trigger_config?: Json
          nodes?: Json
          edges?: Json
          viewport?: Json
          priority?: number
          times_triggered?: number
          times_completed?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          status?: string
          is_template?: boolean
          business_type?: string | null
          trigger_type?: string
          trigger_config?: Json
          nodes?: Json
          edges?: Json
          viewport?: Json
          priority?: number
          times_triggered?: number
          times_completed?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
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
      // ============================================
      // BOOKABLE RESOURCES (Tables, Rooms, Sites)
      // ============================================
      bookable_resources: {
        Row: {
          id: string
          store_id: string
          type: 'table' | 'room' | 'tent_site' | 'rv_site' | 'ger' | 'cabin'
          name: string
          description: string | null
          capacity: number
          price_per_unit: number
          features: Json
          images: Json
          status: 'available' | 'occupied' | 'maintenance' | 'reserved'
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          type: 'table' | 'room' | 'tent_site' | 'rv_site' | 'ger' | 'cabin'
          name: string
          description?: string | null
          capacity?: number
          price_per_unit?: number
          features?: Json
          images?: Json
          status?: 'available' | 'occupied' | 'maintenance' | 'reserved'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          type?: 'table' | 'room' | 'tent_site' | 'rv_site' | 'ger' | 'cabin'
          name?: string
          description?: string | null
          capacity?: number
          price_per_unit?: number
          features?: Json
          images?: Json
          status?: 'available' | 'occupied' | 'maintenance' | 'reserved'
          sort_order?: number
          created_at?: string
          updated_at?: string
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
      flow_execution_logs: {
        Row: {
          id: string
          store_id: string
          flow_id: string
          conversation_id: string | null
          started_at: string
          completed_at: string | null
          status: string
          nodes_visited: number
          variables_collected: Json
          exit_node_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          flow_id: string
          conversation_id?: string | null
          started_at?: string
          completed_at?: string | null
          status?: string
          nodes_visited?: number
          variables_collected?: Json
          exit_node_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          flow_id?: string
          conversation_id?: string | null
          started_at?: string
          completed_at?: string | null
          status?: string
          nodes_visited?: number
          variables_collected?: Json
          exit_node_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_execution_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            foreignKeyName: "flow_execution_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          id: string
          store_id: string
          order_id: string
          customer_id: string | null
          return_number: string
          handled_by: string | null
          handled_by_user_id: string | null
          return_type: 'full' | 'partial'
          reason: string | null
          status: 'pending' | 'approved' | 'rejected' | 'completed'
          refund_amount: number | null
          refund_method: 'qpay' | 'bank' | 'cash' | 'original' | null
          admin_notes: string | null
          approved_at: string | null
          completed_at: string | null
          rejected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          order_id: string
          customer_id?: string | null
          return_number: string
          handled_by?: string | null
          handled_by_user_id?: string | null
          return_type: 'full' | 'partial'
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          refund_amount?: number | null
          refund_method?: 'qpay' | 'bank' | 'cash' | 'original' | null
          admin_notes?: string | null
          approved_at?: string | null
          completed_at?: string | null
          rejected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          order_id?: string
          customer_id?: string | null
          return_number?: string
          handled_by?: string | null
          handled_by_user_id?: string | null
          return_type?: 'full' | 'partial'
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'completed'
          refund_amount?: number | null
          refund_method?: 'qpay' | 'bank' | 'cash' | 'original' | null
          admin_notes?: string | null
          approved_at?: string | null
          completed_at?: string | null
          rejected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          id: string
          return_id: string
          order_item_id: string
          product_id: string | null
          variant_id: string | null
          quantity: number
          unit_price: number
          subtotal: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          order_item_id: string
          product_id?: string | null
          variant_id?: string | null
          quantity: number
          unit_price: number
          subtotal: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          order_item_id?: string
          product_id?: string | null
          variant_id?: string | null
          quantity?: number
          unit_price?: number
          subtotal?: number
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_policies: {
        Row: {
          id: string
          store_id: string
          complaint_category: 'food_quality' | 'wrong_item' | 'delivery_delay' | 'service_quality' | 'damaged_item' | 'pricing_error' | 'staff_behavior' | 'other'
          name: string
          compensation_type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value: number
          max_discount_amount: number | null
          valid_days: number
          auto_approve: boolean
          requires_confirmation: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          complaint_category: 'food_quality' | 'wrong_item' | 'delivery_delay' | 'service_quality' | 'damaged_item' | 'pricing_error' | 'staff_behavior' | 'other'
          name: string
          compensation_type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value: number
          max_discount_amount?: number | null
          valid_days?: number
          auto_approve?: boolean
          requires_confirmation?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          complaint_category?: 'food_quality' | 'wrong_item' | 'delivery_delay' | 'service_quality' | 'damaged_item' | 'pricing_error' | 'staff_behavior' | 'other'
          name?: string
          compensation_type?: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value?: number
          max_discount_amount?: number | null
          valid_days?: number
          auto_approve?: boolean
          requires_confirmation?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
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
      vouchers: {
        Row: {
          id: string
          store_id: string
          customer_id: string
          policy_id: string | null
          voucher_code: string
          compensation_type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value: number
          max_discount_amount: number | null
          complaint_category: string | null
          complaint_summary: string | null
          conversation_id: string | null
          status: 'pending_approval' | 'approved' | 'rejected' | 'redeemed' | 'expired'
          approved_by: string | null
          approved_by_user_id: string | null
          redeemed_at: string | null
          redeemed_order_id: string | null
          valid_until: string
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          customer_id: string
          policy_id?: string | null
          voucher_code: string
          compensation_type: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value: number
          max_discount_amount?: number | null
          complaint_category?: string | null
          complaint_summary?: string | null
          conversation_id?: string | null
          status?: 'pending_approval' | 'approved' | 'rejected' | 'redeemed' | 'expired'
          approved_by?: string | null
          approved_by_user_id?: string | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          valid_until: string
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          customer_id?: string
          policy_id?: string | null
          voucher_code?: string
          compensation_type?: 'percent_discount' | 'fixed_discount' | 'free_shipping' | 'free_item'
          compensation_value?: number
          max_discount_amount?: number | null
          complaint_category?: string | null
          complaint_summary?: string | null
          conversation_id?: string | null
          status?: 'pending_approval' | 'approved' | 'rejected' | 'redeemed' | 'expired'
          approved_by?: string | null
          approved_by_user_id?: string | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          valid_until?: string
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
        ]
      }
    // ============================================
    // DELIVERY MANAGEMENT
    // ============================================
    delivery_drivers: {
      Row: {
        id: string
        store_id: string
        user_id: string | null
        name: string
        phone: string
        email: string | null
        vehicle_type: 'motorcycle' | 'car' | 'bicycle' | 'on_foot' | null
        vehicle_number: string | null
        status: 'active' | 'inactive' | 'on_delivery'
        current_location: Json | null
        metadata: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        user_id?: string | null
        name: string
        phone: string
        email?: string | null
        vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'on_foot' | null
        vehicle_number?: string | null
        status?: 'active' | 'inactive' | 'on_delivery'
        current_location?: Json | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        user_id?: string | null
        name?: string
        phone?: string
        email?: string | null
        vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'on_foot' | null
        vehicle_number?: string | null
        status?: 'active' | 'inactive' | 'on_delivery'
        current_location?: Json | null
        metadata?: Json
        created_at?: string
        updated_at?: string
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
    deliveries: {
      Row: {
        id: string
        store_id: string
        order_id: string | null
        driver_id: string | null
        delivery_number: string
        status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'delayed'
        delivery_type: 'own_driver' | 'external_provider'
        provider_name: string | null
        provider_tracking_id: string | null
        pickup_address: string | null
        delivery_address: string
        customer_name: string | null
        customer_phone: string | null
        estimated_delivery_time: string | null
        actual_delivery_time: string | null
        delivery_fee: number
        notes: string | null
        failure_reason: string | null
        proof_photo_url: string | null
        metadata: Json
        ai_assignment: Json | null
        scheduled_date: string | null
        scheduled_time_slot: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        order_id?: string | null
        driver_id?: string | null
        delivery_number: string
        status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'delayed'
        delivery_type?: 'own_driver' | 'external_provider'
        provider_name?: string | null
        provider_tracking_id?: string | null
        pickup_address?: string | null
        delivery_address: string
        customer_name?: string | null
        customer_phone?: string | null
        estimated_delivery_time?: string | null
        actual_delivery_time?: string | null
        delivery_fee?: number
        notes?: string | null
        failure_reason?: string | null
        proof_photo_url?: string | null
        metadata?: Json
        ai_assignment?: Json | null
        scheduled_date?: string | null
        scheduled_time_slot?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        order_id?: string | null
        driver_id?: string | null
        delivery_number?: string
        status?: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' | 'delayed'
        delivery_type?: 'own_driver' | 'external_provider'
        provider_name?: string | null
        provider_tracking_id?: string | null
        pickup_address?: string | null
        delivery_address?: string
        customer_name?: string | null
        customer_phone?: string | null
        estimated_delivery_time?: string | null
        actual_delivery_time?: string | null
        delivery_fee?: number
        notes?: string | null
        failure_reason?: string | null
        proof_photo_url?: string | null
        metadata?: Json
        ai_assignment?: Json | null
        scheduled_date?: string | null
        scheduled_time_slot?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "deliveries_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "deliveries_driver_id_fkey"
          columns: ["driver_id"]
          isOneToOne: false
          referencedRelation: "delivery_drivers"
          referencedColumns: ["id"]
        },
      ]
    }
    driver_payouts: {
      Row: {
        id: string
        driver_id: string
        store_id: string
        period_start: string
        period_end: string
        total_amount: number
        delivery_count: number
        status: 'pending' | 'approved' | 'paid' | 'cancelled'
        paid_at: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        driver_id: string
        store_id: string
        period_start: string
        period_end: string
        total_amount?: number
        delivery_count?: number
        status?: 'pending' | 'approved' | 'paid' | 'cancelled'
        paid_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        driver_id?: string
        store_id?: string
        period_start?: string
        period_end?: string
        total_amount?: number
        delivery_count?: number
        status?: 'pending' | 'approved' | 'paid' | 'cancelled'
        paid_at?: string | null
        notes?: string | null
        created_at?: string
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
        id: string
        delivery_id: string
        driver_id: string
        store_id: string
        customer_name: string | null
        rating: number
        comment: string | null
        created_at: string
      }
      Insert: {
        id?: string
        delivery_id: string
        driver_id: string
        store_id: string
        customer_name?: string | null
        rating: number
        comment?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        delivery_id?: string
        driver_id?: string
        store_id?: string
        customer_name?: string | null
        rating?: number
        comment?: string | null
        created_at?: string
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
    driver_messages: {
      Row: {
        id: string
        store_id: string
        driver_id: string
        sender_type: 'store' | 'driver'
        message: string
        read_at: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        driver_id: string
        sender_type: 'store' | 'driver'
        message: string
        read_at?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        driver_id?: string
        sender_type?: 'store' | 'driver'
        message?: string
        read_at?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "driver_messages_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "driver_messages_driver_id_fkey"
          columns: ["driver_id"]
          isOneToOne: false
          referencedRelation: "delivery_drivers"
          referencedColumns: ["id"]
        },
      ]
    }
    driver_store_assignments: {
      Row: {
        id: string
        driver_id: string
        store_id: string
        status: string
        assigned_at: string
      }
      Insert: {
        id?: string
        driver_id: string
        store_id: string
        status?: string
        assigned_at?: string
      }
      Update: {
        id?: string
        driver_id?: string
        store_id?: string
        status?: string
        assigned_at?: string
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
    delivery_status_log: {
      Row: {
        id: string
        delivery_id: string
        status: string
        changed_by: string | null
        notes: string | null
        location: Json | null
        created_at: string
      }
      Insert: {
        id?: string
        delivery_id: string
        status: string
        changed_by?: string | null
        notes?: string | null
        location?: Json | null
        created_at?: string
      }
      Update: {
        id?: string
        delivery_id?: string
        status?: string
        changed_by?: string | null
        notes?: string | null
        location?: Json | null
        created_at?: string
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
    deals: {
      Row: {
        id: string
        store_id: string
        deal_number: string
        property_id: string | null
        customer_id: string | null
        agent_id: string | null
        status: string
        deal_type: string
        asking_price: number | null
        offer_price: number | null
        final_price: number | null
        commission_rate: number
        commission_amount: number | null
        agent_share_rate: number
        agent_share_amount: number | null
        company_share_amount: number | null
        viewing_date: string | null
        offer_date: string | null
        contract_date: string | null
        closed_date: string | null
        withdrawn_date: string | null
        notes: string | null
        metadata: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        deal_number: string
        property_id?: string | null
        customer_id?: string | null
        agent_id?: string | null
        status?: string
        deal_type?: string
        asking_price?: number | null
        offer_price?: number | null
        final_price?: number | null
        commission_rate?: number
        commission_amount?: number | null
        agent_share_rate?: number
        agent_share_amount?: number | null
        company_share_amount?: number | null
        viewing_date?: string | null
        offer_date?: string | null
        contract_date?: string | null
        closed_date?: string | null
        withdrawn_date?: string | null
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        deal_number?: string
        property_id?: string | null
        customer_id?: string | null
        agent_id?: string | null
        status?: string
        deal_type?: string
        asking_price?: number | null
        offer_price?: number | null
        final_price?: number | null
        commission_rate?: number
        commission_amount?: number | null
        agent_share_rate?: number
        agent_share_amount?: number | null
        company_share_amount?: number | null
        viewing_date?: string | null
        offer_date?: string | null
        contract_date?: string | null
        closed_date?: string | null
        withdrawn_date?: string | null
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "deals_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "deals_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "deals_agent_id_fkey"
          columns: ["agent_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    agent_commissions: {
      Row: {
        id: string
        deal_id: string
        agent_id: string
        store_id: string
        commission_amount: number
        agent_share: number
        company_share: number
        status: string
        paid_at: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        deal_id: string
        agent_id: string
        store_id: string
        commission_amount: number
        agent_share: number
        company_share: number
        status?: string
        paid_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        deal_id?: string
        agent_id?: string
        store_id?: string
        commission_amount?: number
        agent_share?: number
        company_share?: number
        status?: string
        paid_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "agent_commissions_deal_id_fkey"
          columns: ["deal_id"]
          isOneToOne: false
          referencedRelation: "deals"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "agent_commissions_agent_id_fkey"
          columns: ["agent_id"]
          isOneToOne: false
          referencedRelation: "staff"
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
    // ============================================
    // CORE FOUNDATION (Migration 025)
    // ============================================
    audit_logs: {
      Row: {
        id: string
        store_id: string
        entity_type: string
        entity_id: string
        action: 'create' | 'update' | 'delete' | 'status_change'
        actor_id: string | null
        actor_type: 'user' | 'system' | 'ai' | 'customer'
        changes: Json
        metadata: Json
        ip_address: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        entity_type: string
        entity_id: string
        action: 'create' | 'update' | 'delete' | 'status_change'
        actor_id?: string | null
        actor_type?: 'user' | 'system' | 'ai' | 'customer'
        changes?: Json
        metadata?: Json
        ip_address?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        entity_type?: string
        entity_id?: string
        action?: 'create' | 'update' | 'delete' | 'status_change'
        actor_id?: string | null
        actor_type?: 'user' | 'system' | 'ai' | 'customer'
        changes?: Json
        metadata?: Json
        ip_address?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "audit_logs_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "audit_logs_actor_id_fkey"
          columns: ["actor_id"]
          isOneToOne: false
          referencedRelation: "users"
          referencedColumns: ["id"]
        },
      ]
    }
    attachments: {
      Row: {
        id: string
        store_id: string
        entity_type: string
        entity_id: string
        file_name: string
        file_url: string
        file_type: string | null
        file_size: number | null
        uploaded_by: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        entity_type: string
        entity_id: string
        file_name: string
        file_url: string
        file_type?: string | null
        file_size?: number | null
        uploaded_by?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        entity_type?: string
        entity_id?: string
        file_name?: string
        file_url?: string
        file_type?: string | null
        file_size?: number | null
        uploaded_by?: string | null
        created_at?: string
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
    blocks: {
      Row: {
        id: string
        store_id: string
        staff_id: string | null
        resource_id: string | null
        start_at: string
        end_at: string
        reason: string | null
        block_type: 'manual' | 'break' | 'holiday' | 'maintenance'
        recurring: Json | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        staff_id?: string | null
        resource_id?: string | null
        start_at: string
        end_at: string
        reason?: string | null
        block_type?: 'manual' | 'break' | 'holiday' | 'maintenance'
        recurring?: Json | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        staff_id?: string | null
        resource_id?: string | null
        start_at?: string
        end_at?: string
        reason?: string | null
        block_type?: 'manual' | 'break' | 'holiday' | 'maintenance'
        recurring?: Json | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "blocks_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "blocks_resource_id_fkey"
          columns: ["resource_id"]
          isOneToOne: false
          referencedRelation: "bookable_resources"
          referencedColumns: ["id"]
        },
      ]
    }
    booking_items: {
      Row: {
        id: string
        store_id: string
        appointment_id: string
        service_id: string | null
        variation_id: string | null
        staff_id: string | null
        resource_id: string | null
        start_at: string
        end_at: string
        price: number
        status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        appointment_id: string
        service_id?: string | null
        variation_id?: string | null
        staff_id?: string | null
        resource_id?: string | null
        start_at: string
        end_at: string
        price?: number
        status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        appointment_id?: string
        service_id?: string | null
        variation_id?: string | null
        staff_id?: string | null
        resource_id?: string | null
        start_at?: string
        end_at?: string
        price?: number
        status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "booking_items_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "booking_items_appointment_id_fkey"
          columns: ["appointment_id"]
          isOneToOne: false
          referencedRelation: "appointments"
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
          foreignKeyName: "booking_items_variation_id_fkey"
          columns: ["variation_id"]
          isOneToOne: false
          referencedRelation: "service_variations"
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
          foreignKeyName: "booking_items_resource_id_fkey"
          columns: ["resource_id"]
          isOneToOne: false
          referencedRelation: "bookable_resources"
          referencedColumns: ["id"]
        },
      ]
    }
    // ============================================
    // UNIVERSAL BILLING (Migration 026)
    // ============================================
    invoices: {
      Row: {
        id: string
        store_id: string
        invoice_number: string
        party_type: 'customer' | 'supplier' | 'staff' | 'driver'
        party_id: string | null
        source_type: 'order' | 'appointment' | 'reservation' | 'manual' | 'subscription' | null
        source_id: string | null
        status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded'
        subtotal: number
        tax_amount: number
        discount_amount: number
        total_amount: number
        amount_paid: number
        amount_due: number
        currency: string
        due_date: string | null
        issued_at: string
        notes: string | null
        metadata: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        invoice_number: string
        party_type: 'customer' | 'supplier' | 'staff' | 'driver'
        party_id?: string | null
        source_type?: 'order' | 'appointment' | 'reservation' | 'manual' | 'subscription' | null
        source_id?: string | null
        status?: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded'
        subtotal?: number
        tax_amount?: number
        discount_amount?: number
        total_amount?: number
        amount_paid?: number
        amount_due?: number
        currency?: string
        due_date?: string | null
        issued_at?: string
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        invoice_number?: string
        party_type?: 'customer' | 'supplier' | 'staff' | 'driver'
        party_id?: string | null
        source_type?: 'order' | 'appointment' | 'reservation' | 'manual' | 'subscription' | null
        source_id?: string | null
        status?: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded'
        subtotal?: number
        tax_amount?: number
        discount_amount?: number
        total_amount?: number
        amount_paid?: number
        amount_due?: number
        currency?: string
        due_date?: string | null
        issued_at?: string
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
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
    invoice_items: {
      Row: {
        id: string
        invoice_id: string
        description: string
        quantity: number
        unit_price: number
        discount: number
        tax_rate: number
        line_total: number
        item_type: 'product' | 'service' | 'fee' | 'discount' | 'tax' | 'custom' | null
        item_id: string | null
        sort_order: number
        created_at: string
      }
      Insert: {
        id?: string
        invoice_id: string
        description: string
        quantity?: number
        unit_price?: number
        discount?: number
        tax_rate?: number
        line_total?: number
        item_type?: 'product' | 'service' | 'fee' | 'discount' | 'tax' | 'custom' | null
        item_id?: string | null
        sort_order?: number
        created_at?: string
      }
      Update: {
        id?: string
        invoice_id?: string
        description?: string
        quantity?: number
        unit_price?: number
        discount?: number
        tax_rate?: number
        line_total?: number
        item_type?: 'product' | 'service' | 'fee' | 'discount' | 'tax' | 'custom' | null
        item_id?: string | null
        sort_order?: number
        created_at?: string
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
    billing_payments: {
      Row: {
        id: string
        store_id: string
        invoice_id: string | null
        payment_number: string
        amount: number
        method: 'cash' | 'bank' | 'qpay' | 'card' | 'online' | 'credit'
        status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'
        gateway_ref: string | null
        gateway_response: Json
        paid_at: string
        notes: string | null
        metadata: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        invoice_id?: string | null
        payment_number: string
        amount: number
        method: 'cash' | 'bank' | 'qpay' | 'card' | 'online' | 'credit'
        status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'
        gateway_ref?: string | null
        gateway_response?: Json
        paid_at?: string
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        invoice_id?: string | null
        payment_number?: string
        amount?: number
        method?: 'cash' | 'bank' | 'qpay' | 'card' | 'online' | 'credit'
        status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'
        gateway_ref?: string | null
        gateway_response?: Json
        paid_at?: string
        notes?: string | null
        metadata?: Json
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "billing_payments_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "billing_payments_invoice_id_fkey"
          columns: ["invoice_id"]
          isOneToOne: false
          referencedRelation: "invoices"
          referencedColumns: ["id"]
        },
      ]
    }
    payment_allocations: {
      Row: {
        id: string
        payment_id: string
        invoice_id: string
        amount: number
        created_at: string
      }
      Insert: {
        id?: string
        payment_id: string
        invoice_id: string
        amount: number
        created_at?: string
      }
      Update: {
        id?: string
        payment_id?: string
        invoice_id?: string
        amount?: number
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "payment_allocations_payment_id_fkey"
          columns: ["payment_id"]
          isOneToOne: false
          referencedRelation: "billing_payments"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "payment_allocations_invoice_id_fkey"
          columns: ["invoice_id"]
          isOneToOne: false
          referencedRelation: "invoices"
          referencedColumns: ["id"]
        },
      ]
    }
    // ============================================
    // QSR / FOOD VERTICAL (Migration 027)
    // ============================================
    menu_categories: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        image_url: string | null
        sort_order: number
        is_active: boolean
        available_from: string | null
        available_until: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        image_url?: string | null
        sort_order?: number
        is_active?: boolean
        available_from?: string | null
        available_until?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        image_url?: string | null
        sort_order?: number
        is_active?: boolean
        available_from?: string | null
        available_until?: string | null
        created_at?: string
        updated_at?: string
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
    modifier_groups: {
      Row: {
        id: string
        store_id: string
        name: string
        selection_type: 'single' | 'multiple'
        min_selections: number
        max_selections: number
        is_required: boolean
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        selection_type?: 'single' | 'multiple'
        min_selections?: number
        max_selections?: number
        is_required?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        selection_type?: 'single' | 'multiple'
        min_selections?: number
        max_selections?: number
        is_required?: boolean
        sort_order?: number
        created_at?: string
        updated_at?: string
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
        id: string
        group_id: string
        name: string
        price_adjustment: number
        is_default: boolean
        is_available: boolean
        sort_order: number
        created_at: string
      }
      Insert: {
        id?: string
        group_id: string
        name: string
        price_adjustment?: number
        is_default?: boolean
        is_available?: boolean
        sort_order?: number
        created_at?: string
      }
      Update: {
        id?: string
        group_id?: string
        name?: string
        price_adjustment?: number
        is_default?: boolean
        is_available?: boolean
        sort_order?: number
        created_at?: string
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
    product_modifier_groups: {
      Row: {
        id: string
        product_id: string
        modifier_group_id: string
        sort_order: number
      }
      Insert: {
        id?: string
        product_id: string
        modifier_group_id: string
        sort_order?: number
      }
      Update: {
        id?: string
        product_id?: string
        modifier_group_id?: string
        sort_order?: number
      }
      Relationships: [
        {
          foreignKeyName: "product_modifier_groups_product_id_fkey"
          columns: ["product_id"]
          isOneToOne: false
          referencedRelation: "products"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "product_modifier_groups_modifier_group_id_fkey"
          columns: ["modifier_group_id"]
          isOneToOne: false
          referencedRelation: "modifier_groups"
          referencedColumns: ["id"]
        },
      ]
    }
    kds_stations: {
      Row: {
        id: string
        store_id: string
        name: string
        station_type: 'kitchen' | 'bar' | 'prep' | 'expo' | 'packaging'
        display_categories: string[]
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        station_type?: 'kitchen' | 'bar' | 'prep' | 'expo' | 'packaging'
        display_categories?: string[]
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        station_type?: 'kitchen' | 'bar' | 'prep' | 'expo' | 'packaging'
        display_categories?: string[]
        is_active?: boolean
        created_at?: string
        updated_at?: string
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
    order_item_modifiers: {
      Row: {
        id: string
        order_item_id: string
        modifier_id: string
        price_adjustment: number
        created_at: string
      }
      Insert: {
        id?: string
        order_item_id: string
        modifier_id: string
        price_adjustment?: number
        created_at?: string
      }
      Update: {
        id?: string
        order_item_id?: string
        modifier_id?: string
        price_adjustment?: number
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "order_item_modifiers_order_item_id_fkey"
          columns: ["order_item_id"]
          isOneToOne: false
          referencedRelation: "order_items"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "order_item_modifiers_modifier_id_fkey"
          columns: ["modifier_id"]
          isOneToOne: false
          referencedRelation: "modifiers"
          referencedColumns: ["id"]
        },
      ]
    }
    promotions: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        promo_type: 'item_discount' | 'order_discount' | 'bogo' | 'combo' | 'free_item' | 'loyalty'
        discount_type: 'percent' | 'fixed' | 'free' | null
        discount_value: number
        conditions: Json
        min_order_amount: number | null
        max_discount_amount: number | null
        applicable_products: string[] | null
        applicable_categories: string[] | null
        start_date: string | null
        end_date: string | null
        is_active: boolean
        usage_count: number
        max_usage: number | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        promo_type: 'item_discount' | 'order_discount' | 'bogo' | 'combo' | 'free_item' | 'loyalty'
        discount_type?: 'percent' | 'fixed' | 'free' | null
        discount_value?: number
        conditions?: Json
        min_order_amount?: number | null
        max_discount_amount?: number | null
        applicable_products?: string[] | null
        applicable_categories?: string[] | null
        start_date?: string | null
        end_date?: string | null
        is_active?: boolean
        usage_count?: number
        max_usage?: number | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        promo_type?: 'item_discount' | 'order_discount' | 'bogo' | 'combo' | 'free_item' | 'loyalty'
        discount_type?: 'percent' | 'fixed' | 'free' | null
        discount_value?: number
        conditions?: Json
        min_order_amount?: number | null
        max_discount_amount?: number | null
        applicable_products?: string[] | null
        applicable_categories?: string[] | null
        start_date?: string | null
        end_date?: string | null
        is_active?: boolean
        usage_count?: number
        max_usage?: number | null
        created_at?: string
        updated_at?: string
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
    // ----- Beauty / Wellness (Phase 4) -----
    service_packages: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        price: number
        original_price: number | null
        is_active: boolean
        valid_days: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        price: number
        original_price?: number | null
        is_active?: boolean
        valid_days?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        price?: number
        original_price?: number | null
        is_active?: boolean
        valid_days?: number
        created_at?: string
        updated_at?: string
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
    package_services: {
      Row: {
        id: string
        package_id: string
        service_id: string
        quantity: number
      }
      Insert: {
        id?: string
        package_id: string
        service_id: string
        quantity?: number
      }
      Update: {
        id?: string
        package_id?: string
        service_id?: string
        quantity?: number
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
    memberships: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        price: number
        billing_period: string
        benefits: Json
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        price: number
        billing_period?: string
        benefits?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        price?: number
        billing_period?: string
        benefits?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
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
    customer_memberships: {
      Row: {
        id: string
        store_id: string
        customer_id: string
        membership_id: string
        status: string
        started_at: string
        expires_at: string | null
        services_used: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id: string
        membership_id: string
        status?: string
        started_at?: string
        expires_at?: string | null
        services_used?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string
        membership_id?: string
        status?: string
        started_at?: string
        expires_at?: string | null
        services_used?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "customer_memberships_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    client_preferences: {
      Row: {
        id: string
        store_id: string
        customer_id: string
        skin_type: string | null
        hair_type: string | null
        allergies: string[]
        preferred_staff_id: string | null
        color_history: Json
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id: string
        skin_type?: string | null
        hair_type?: string | null
        allergies?: string[]
        preferred_staff_id?: string | null
        color_history?: Json
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string
        skin_type?: string | null
        hair_type?: string | null
        allergies?: string[]
        preferred_staff_id?: string | null
        color_history?: Json
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "client_preferences_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    staff_commissions: {
      Row: {
        id: string
        store_id: string
        staff_id: string
        appointment_id: string | null
        sale_type: string
        sale_amount: number
        commission_rate: number
        commission_amount: number
        status: string
        paid_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        staff_id: string
        appointment_id?: string | null
        sale_type?: string
        sale_amount: number
        commission_rate: number
        commission_amount: number
        status?: string
        paid_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        staff_id?: string
        appointment_id?: string | null
        sale_type?: string
        sale_amount?: number
        commission_rate?: number
        commission_amount?: number
        status?: string
        paid_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "staff_commissions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "staff_commissions_appointment_id_fkey"
          columns: ["appointment_id"]
          isOneToOne: false
          referencedRelation: "appointments"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Stay / Hospitality (Phase 5) -----
    units: {
      Row: {
        id: string
        store_id: string
        resource_id: string | null
        unit_number: string
        unit_type: string
        floor: string | null
        max_occupancy: number
        base_rate: number
        amenities: Json
        images: Json
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        resource_id?: string | null
        unit_number: string
        unit_type?: string
        floor?: string | null
        max_occupancy?: number
        base_rate: number
        amenities?: Json
        images?: Json
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        resource_id?: string | null
        unit_number?: string
        unit_type?: string
        floor?: string | null
        max_occupancy?: number
        base_rate?: number
        amenities?: Json
        images?: Json
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    guests: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        first_name: string
        last_name: string
        document_type: string | null
        document_number: string | null
        nationality: string | null
        phone: string | null
        email: string | null
        vip_level: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        first_name: string
        last_name: string
        document_type?: string | null
        document_number?: string | null
        nationality?: string | null
        phone?: string | null
        email?: string | null
        vip_level?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        first_name?: string
        last_name?: string
        document_type?: string | null
        document_number?: string | null
        nationality?: string | null
        phone?: string | null
        email?: string | null
        vip_level?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    reservations: {
      Row: {
        id: string
        store_id: string
        unit_id: string
        guest_id: string
        check_in: string
        check_out: string
        actual_check_in: string | null
        actual_check_out: string | null
        adults: number
        children: number
        rate_per_night: number
        total_amount: number
        deposit_amount: number
        deposit_status: string
        status: string
        source: string
        special_requests: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        unit_id: string
        guest_id: string
        check_in: string
        check_out: string
        actual_check_in?: string | null
        actual_check_out?: string | null
        adults?: number
        children?: number
        rate_per_night: number
        total_amount: number
        deposit_amount?: number
        deposit_status?: string
        status?: string
        source?: string
        special_requests?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        unit_id?: string
        guest_id?: string
        check_in?: string
        check_out?: string
        actual_check_in?: string | null
        actual_check_out?: string | null
        adults?: number
        children?: number
        rate_per_night?: number
        total_amount?: number
        deposit_amount?: number
        deposit_status?: string
        status?: string
        source?: string
        special_requests?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    housekeeping_tasks: {
      Row: {
        id: string
        store_id: string
        unit_id: string
        assigned_to: string | null
        task_type: string
        priority: string
        status: string
        scheduled_at: string | null
        completed_at: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        unit_id: string
        assigned_to?: string | null
        task_type?: string
        priority?: string
        status?: string
        scheduled_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        unit_id?: string
        assigned_to?: string | null
        task_type?: string
        priority?: string
        status?: string
        scheduled_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    maintenance_requests: {
      Row: {
        id: string
        store_id: string
        unit_id: string | null
        reported_by: string | null
        assigned_to: string | null
        category: string
        description: string
        priority: string
        status: string
        estimated_cost: number | null
        actual_cost: number | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        unit_id?: string | null
        reported_by?: string | null
        assigned_to?: string | null
        category?: string
        description: string
        priority?: string
        status?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        unit_id?: string | null
        reported_by?: string | null
        assigned_to?: string | null
        category?: string
        description?: string
        priority?: string
        status?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    damage_reports: {
      Row: {
        id: string
        store_id: string
        reservation_id: string | null
        unit_id: string
        guest_id: string | null
        description: string
        damage_type: string
        estimated_cost: number | null
        charged_amount: number
        photos: Json
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        reservation_id?: string | null
        unit_id: string
        guest_id?: string | null
        description: string
        damage_type?: string
        estimated_cost?: number | null
        charged_amount?: number
        photos?: Json
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        reservation_id?: string | null
        unit_id?: string
        guest_id?: string | null
        description?: string
        damage_type?: string
        estimated_cost?: number | null
        charged_amount?: number
        photos?: Json
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    // ----- Retail / POS (Phase 6) -----
    inventory_locations: {
      Row: {
        id: string
        store_id: string
        name: string
        location_type: string
        parent_id: string | null
        barcode: string | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        location_type?: string
        parent_id?: string | null
        barcode?: string | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        location_type?: string
        parent_id?: string | null
        barcode?: string | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    inventory_movements: {
      Row: {
        id: string
        store_id: string
        product_id: string
        variant_id: string | null
        location_id: string | null
        movement_type: string
        quantity: number
        reference_type: string | null
        reference_id: string | null
        unit_cost: number | null
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        product_id: string
        variant_id?: string | null
        location_id?: string | null
        movement_type: string
        quantity: number
        reference_type?: string | null
        reference_id?: string | null
        unit_cost?: number | null
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        product_id?: string
        variant_id?: string | null
        location_id?: string | null
        movement_type?: string
        quantity?: number
        reference_type?: string | null
        reference_id?: string | null
        unit_cost?: number | null
        notes?: string | null
        created_at?: string
      }
      Relationships: []
    }
    suppliers: {
      Row: {
        id: string
        store_id: string
        name: string
        contact_name: string | null
        email: string | null
        phone: string | null
        address: string | null
        payment_terms: string
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        contact_name?: string | null
        email?: string | null
        phone?: string | null
        address?: string | null
        payment_terms?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        contact_name?: string | null
        email?: string | null
        phone?: string | null
        address?: string | null
        payment_terms?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    purchase_orders: {
      Row: {
        id: string
        store_id: string
        supplier_id: string
        po_number: string
        status: string
        total_amount: number
        expected_date: string | null
        received_date: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        supplier_id: string
        po_number: string
        status?: string
        total_amount?: number
        expected_date?: string | null
        received_date?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        supplier_id?: string
        po_number?: string
        status?: string
        total_amount?: number
        expected_date?: string | null
        received_date?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    purchase_order_items: {
      Row: {
        id: string
        purchase_order_id: string
        product_id: string
        variant_id: string | null
        quantity_ordered: number
        quantity_received: number
        unit_cost: number
        created_at: string
      }
      Insert: {
        id?: string
        purchase_order_id: string
        product_id: string
        variant_id?: string | null
        quantity_ordered?: number
        quantity_received?: number
        unit_cost: number
        created_at?: string
      }
      Update: {
        id?: string
        purchase_order_id?: string
        product_id?: string
        variant_id?: string | null
        quantity_ordered?: number
        quantity_received?: number
        unit_cost?: number
        created_at?: string
      }
      Relationships: []
    }
    pos_sessions: {
      Row: {
        id: string
        store_id: string
        opened_by: string
        closed_by: string | null
        register_name: string
        opening_cash: number
        closing_cash: number | null
        total_sales: number
        total_transactions: number
        status: string
        opened_at: string
        closed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        opened_by: string
        closed_by?: string | null
        register_name?: string
        opening_cash?: number
        closing_cash?: number | null
        total_sales?: number
        total_transactions?: number
        status?: string
        opened_at?: string
        closed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        opened_by?: string
        closed_by?: string | null
        register_name?: string
        opening_cash?: number
        closing_cash?: number | null
        total_sales?: number
        total_transactions?: number
        status?: string
        opened_at?: string
        closed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    // ----- Laundry (Phase 7a) -----
    laundry_orders: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        order_number: string
        status: string
        total_items: number
        total_amount: number
        paid_amount: number
        rush_order: boolean
        pickup_date: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        order_number: string
        status?: string
        total_items?: number
        total_amount?: number
        paid_amount?: number
        rush_order?: boolean
        pickup_date?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        order_number?: string
        status?: string
        total_items?: number
        total_amount?: number
        paid_amount?: number
        rush_order?: boolean
        pickup_date?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    laundry_items: {
      Row: {
        id: string
        order_id: string
        item_type: string
        service_type: string
        quantity: number
        unit_price: number
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        order_id: string
        item_type: string
        service_type?: string
        quantity?: number
        unit_price: number
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        order_id?: string
        item_type?: string
        service_type?: string
        quantity?: number
        unit_price?: number
        notes?: string | null
        created_at?: string
      }
      Relationships: []
    }
    machines: {
      Row: {
        id: string
        store_id: string
        name: string
        machine_type: string
        status: string
        capacity_kg: number | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        machine_type?: string
        status?: string
        capacity_kg?: number | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        machine_type?: string
        status?: string
        capacity_kg?: number | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    rack_locations: {
      Row: {
        id: string
        store_id: string
        rack_number: string
        order_id: string | null
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        rack_number: string
        order_id?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        rack_number?: string
        order_id?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    // ----- Medical (Phase 7b) -----
    patients: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        first_name: string
        last_name: string
        date_of_birth: string | null
        gender: string | null
        blood_type: string | null
        phone: string | null
        email: string | null
        emergency_contact: Json
        medical_history: Json
        allergies: string[]
        insurance_info: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        first_name: string
        last_name: string
        date_of_birth?: string | null
        gender?: string | null
        blood_type?: string | null
        phone?: string | null
        email?: string | null
        emergency_contact?: Json
        medical_history?: Json
        allergies?: string[]
        insurance_info?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        first_name?: string
        last_name?: string
        date_of_birth?: string | null
        gender?: string | null
        blood_type?: string | null
        phone?: string | null
        email?: string | null
        emergency_contact?: Json
        medical_history?: Json
        allergies?: string[]
        insurance_info?: Json
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "patients_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "patients_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    encounters: {
      Row: {
        id: string
        store_id: string
        patient_id: string
        provider_id: string | null
        encounter_type: string
        status: string
        chief_complaint: string | null
        diagnosis: string | null
        treatment_plan: string | null
        notes: string | null
        encounter_date: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        patient_id: string
        provider_id?: string | null
        encounter_type?: string
        status?: string
        chief_complaint?: string | null
        diagnosis?: string | null
        treatment_plan?: string | null
        notes?: string | null
        encounter_date?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        patient_id?: string
        provider_id?: string | null
        encounter_type?: string
        status?: string
        chief_complaint?: string | null
        diagnosis?: string | null
        treatment_plan?: string | null
        notes?: string | null
        encounter_date?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "encounters_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    prescriptions: {
      Row: {
        id: string
        store_id: string
        encounter_id: string | null
        patient_id: string
        prescribed_by: string | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        encounter_id?: string | null
        patient_id: string
        prescribed_by?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        encounter_id?: string | null
        patient_id?: string
        prescribed_by?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "prescriptions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
      ]
    }
    prescription_items: {
      Row: {
        id: string
        prescription_id: string
        medication_name: string
        dosage: string
        frequency: string
        duration: string | null
        instructions: string | null
        created_at: string
      }
      Insert: {
        id?: string
        prescription_id: string
        medication_name: string
        dosage: string
        frequency: string
        duration?: string | null
        instructions?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        prescription_id?: string
        medication_name?: string
        dosage?: string
        frequency?: string
        duration?: string | null
        instructions?: string | null
        created_at?: string
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
    medical_notes: {
      Row: {
        id: string
        store_id: string
        encounter_id: string | null
        patient_id: string
        author_id: string | null
        note_type: string
        content: string
        is_private: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        encounter_id?: string | null
        patient_id: string
        author_id?: string | null
        note_type?: string
        content: string
        is_private?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        encounter_id?: string | null
        patient_id?: string
        author_id?: string | null
        note_type?: string
        content?: string
        is_private?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "medical_notes_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "medical_notes_author_id_fkey"
          columns: ["author_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Medical Extended (Phase 7b+) -----
    lab_orders: {
      Row: {
        id: string
        store_id: string
        patient_id: string
        encounter_id: string | null
        ordered_by: string | null
        order_type: string
        test_name: string
        test_code: string | null
        urgency: string
        specimen_type: string | null
        collection_time: string | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        patient_id: string
        encounter_id?: string | null
        ordered_by?: string | null
        order_type?: string
        test_name: string
        test_code?: string | null
        urgency?: string
        specimen_type?: string | null
        collection_time?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        patient_id?: string
        encounter_id?: string | null
        ordered_by?: string | null
        order_type?: string
        test_name?: string
        test_code?: string | null
        urgency?: string
        specimen_type?: string | null
        collection_time?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "lab_orders_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
      ]
    }
    lab_results: {
      Row: {
        id: string
        store_id: string
        order_id: string
        result_data: Json
        interpretation: string | null
        report_url: string | null
        resulted_by: string | null
        resulted_at: string | null
        reviewed_by: string | null
        reviewed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        order_id: string
        result_data?: Json
        interpretation?: string | null
        report_url?: string | null
        resulted_by?: string | null
        resulted_at?: string | null
        reviewed_by?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        order_id?: string
        result_data?: Json
        interpretation?: string | null
        report_url?: string | null
        resulted_by?: string | null
        resulted_at?: string | null
        reviewed_by?: string | null
        reviewed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "lab_results_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    admissions: {
      Row: {
        id: string
        store_id: string
        patient_id: string
        attending_staff_id: string | null
        admit_diagnosis: string | null
        admit_at: string
        discharge_at: string | null
        discharge_summary: string | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        patient_id: string
        attending_staff_id?: string | null
        admit_diagnosis?: string | null
        admit_at?: string
        discharge_at?: string | null
        discharge_summary?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        patient_id?: string
        attending_staff_id?: string | null
        admit_diagnosis?: string | null
        admit_at?: string
        discharge_at?: string | null
        discharge_summary?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "admissions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "admissions_attending_staff_id_fkey"
          columns: ["attending_staff_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    bed_assignments: {
      Row: {
        id: string
        store_id: string
        admission_id: string
        unit_id: string | null
        start_at: string
        end_at: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        admission_id: string
        unit_id?: string | null
        start_at?: string
        end_at?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        admission_id?: string
        unit_id?: string | null
        start_at?: string
        end_at?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "bed_assignments_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "bed_assignments_admission_id_fkey"
          columns: ["admission_id"]
          isOneToOne: false
          referencedRelation: "admissions"
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
    medical_complaints: {
      Row: {
        id: string
        store_id: string
        patient_id: string | null
        encounter_id: string | null
        category: string
        severity: string
        description: string
        status: string
        assigned_to: string | null
        resolution: string | null
        resolved_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        patient_id?: string | null
        encounter_id?: string | null
        category?: string
        severity?: string
        description: string
        status?: string
        assigned_to?: string | null
        resolution?: string | null
        resolved_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        patient_id?: string | null
        encounter_id?: string | null
        category?: string
        severity?: string
        description?: string
        status?: string
        assigned_to?: string | null
        resolution?: string | null
        resolved_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "medical_complaints_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "medical_complaints_encounter_id_fkey"
          columns: ["encounter_id"]
          isOneToOne: false
          referencedRelation: "encounters"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "medical_complaints_assigned_to_fkey"
          columns: ["assigned_to"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Education (Phase 7c) -----
    programs: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        program_type: string
        duration_weeks: number | null
        price: number | null
        max_students: number | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        program_type?: string
        duration_weeks?: number | null
        price?: number | null
        max_students?: number | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        program_type?: string
        duration_weeks?: number | null
        price?: number | null
        max_students?: number | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
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
    course_sessions: {
      Row: {
        id: string
        store_id: string
        program_id: string
        instructor_id: string | null
        title: string
        scheduled_at: string
        duration_minutes: number
        location: string | null
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        program_id: string
        instructor_id?: string | null
        title: string
        scheduled_at: string
        duration_minutes?: number
        location?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        program_id?: string
        instructor_id?: string | null
        title?: string
        scheduled_at?: string
        duration_minutes?: number
        location?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "course_sessions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "course_sessions_instructor_id_fkey"
          columns: ["instructor_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    students: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        first_name: string
        last_name: string
        email: string | null
        phone: string | null
        date_of_birth: string | null
        guardian_name: string | null
        guardian_phone: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        first_name: string
        last_name: string
        email?: string | null
        phone?: string | null
        date_of_birth?: string | null
        guardian_name?: string | null
        guardian_phone?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        first_name?: string
        last_name?: string
        email?: string | null
        phone?: string | null
        date_of_birth?: string | null
        guardian_name?: string | null
        guardian_phone?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "students_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "students_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    enrollments: {
      Row: {
        id: string
        store_id: string
        student_id: string
        program_id: string
        status: string
        enrolled_at: string
        completed_at: string | null
        grade: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        student_id: string
        program_id: string
        status?: string
        enrolled_at?: string
        completed_at?: string | null
        grade?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        student_id?: string
        program_id?: string
        status?: string
        enrolled_at?: string
        completed_at?: string | null
        grade?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "enrollments_program_id_fkey"
          columns: ["program_id"]
          isOneToOne: false
          referencedRelation: "programs"
          referencedColumns: ["id"]
        },
      ]
    }
    attendance: {
      Row: {
        id: string
        store_id: string
        session_id: string
        student_id: string
        status: string
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        session_id: string
        student_id: string
        status?: string
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        session_id?: string
        student_id?: string
        status?: string
        notes?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "attendance_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "attendance_session_id_fkey"
          columns: ["session_id"]
          isOneToOne: false
          referencedRelation: "course_sessions"
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
    grades: {
      Row: {
        id: string
        store_id: string
        enrollment_id: string
        assessment_name: string
        score: number | null
        max_score: number
        weight: number
        notes: string | null
        graded_at: string
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        enrollment_id: string
        assessment_name: string
        score?: number | null
        max_score?: number
        weight?: number
        notes?: string | null
        graded_at?: string
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        enrollment_id?: string
        assessment_name?: string
        score?: number | null
        max_score?: number
        weight?: number
        notes?: string | null
        graded_at?: string
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "grades_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "grades_enrollment_id_fkey"
          columns: ["enrollment_id"]
          isOneToOne: false
          referencedRelation: "enrollments"
          referencedColumns: ["id"]
        },
      ]
    }
    // ============================================================
    // Phase 8: Pet Services + Car Wash + Wellness
    // ============================================================
    pets: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        name: string
        species: string
        breed: string | null
        weight: number | null
        date_of_birth: string | null
        medical_notes: string | null
        vaccinations: Json
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        name: string
        species?: string
        breed?: string | null
        weight?: number | null
        date_of_birth?: string | null
        medical_notes?: string | null
        vaccinations?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        name?: string
        species?: string
        breed?: string | null
        weight?: number | null
        date_of_birth?: string | null
        medical_notes?: string | null
        vaccinations?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "pets_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "pets_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    pet_appointments: {
      Row: {
        id: string
        store_id: string
        pet_id: string
        service_id: string | null
        staff_id: string | null
        scheduled_at: string
        duration_minutes: number
        status: string
        notes: string | null
        total_amount: number | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        pet_id: string
        service_id?: string | null
        staff_id?: string | null
        scheduled_at: string
        duration_minutes?: number
        status?: string
        notes?: string | null
        total_amount?: number | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        pet_id?: string
        service_id?: string | null
        staff_id?: string | null
        scheduled_at?: string
        duration_minutes?: number
        status?: string
        notes?: string | null
        total_amount?: number | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "pet_appointments_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    vehicles: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        plate_number: string
        make: string | null
        model: string | null
        color: string | null
        vehicle_type: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        plate_number: string
        make?: string | null
        model?: string | null
        color?: string | null
        vehicle_type?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        plate_number?: string
        make?: string | null
        model?: string | null
        color?: string | null
        vehicle_type?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "vehicles_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "vehicles_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    wash_orders: {
      Row: {
        id: string
        store_id: string
        vehicle_id: string
        customer_id: string | null
        order_number: string
        service_type: string
        status: string
        total_amount: number
        bay_number: number | null
        started_at: string | null
        completed_at: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        vehicle_id: string
        customer_id?: string | null
        order_number: string
        service_type?: string
        status?: string
        total_amount?: number
        bay_number?: number | null
        started_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        vehicle_id?: string
        customer_id?: string | null
        order_number?: string
        service_type?: string
        status?: string
        total_amount?: number
        bay_number?: number | null
        started_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "wash_orders_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    treatment_plans: {
      Row: {
        id: string
        store_id: string
        customer_id: string
        name: string
        description: string | null
        sessions_total: number
        sessions_used: number
        start_date: string | null
        end_date: string | null
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id: string
        name: string
        description?: string | null
        sessions_total?: number
        sessions_used?: number
        start_date?: string | null
        end_date?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string
        name?: string
        description?: string | null
        sessions_total?: number
        sessions_used?: number
        start_date?: string | null
        end_date?: string | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "treatment_plans_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "treatment_plans_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    treatment_sessions: {
      Row: {
        id: string
        store_id: string
        treatment_plan_id: string
        appointment_id: string | null
        session_number: number
        status: string
        notes: string | null
        results: string | null
        performed_at: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        treatment_plan_id: string
        appointment_id?: string | null
        session_number?: number
        status?: string
        notes?: string | null
        results?: string | null
        performed_at?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        treatment_plan_id?: string
        appointment_id?: string | null
        session_number?: number
        status?: string
        notes?: string | null
        results?: string | null
        performed_at?: string | null
        created_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "treatment_sessions_appointment_id_fkey"
          columns: ["appointment_id"]
          isOneToOne: false
          referencedRelation: "appointments"
          referencedColumns: ["id"]
        },
      ]
    }
    // Phase 9: Photography + Venue + Coworking
    photo_sessions: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        photographer_id: string | null
        session_type: string
        location: string | null
        scheduled_at: string
        duration_minutes: number
        status: string
        total_amount: number | null
        deposit_amount: number | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        photographer_id?: string | null
        session_type?: string
        location?: string | null
        scheduled_at: string
        duration_minutes?: number
        status?: string
        total_amount?: number | null
        deposit_amount?: number | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        photographer_id?: string | null
        session_type?: string
        location?: string | null
        scheduled_at?: string
        duration_minutes?: number
        status?: string
        total_amount?: number | null
        deposit_amount?: number | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "photo_sessions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    photo_galleries: {
      Row: {
        id: string
        store_id: string
        session_id: string
        name: string
        description: string | null
        gallery_url: string | null
        download_url: string | null
        password: string | null
        photo_count: number
        status: string
        delivered_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        session_id: string
        name: string
        description?: string | null
        gallery_url?: string | null
        download_url?: string | null
        password?: string | null
        photo_count?: number
        status?: string
        delivered_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        session_id?: string
        name?: string
        description?: string | null
        gallery_url?: string | null
        download_url?: string | null
        password?: string | null
        photo_count?: number
        status?: string
        delivered_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "photo_galleries_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "photo_galleries_session_id_fkey"
          columns: ["session_id"]
          isOneToOne: false
          referencedRelation: "photo_sessions"
          referencedColumns: ["id"]
        },
      ]
    }
    venues: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        capacity: number
        hourly_rate: number | null
        daily_rate: number | null
        amenities: Json
        images: Json
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        capacity?: number
        hourly_rate?: number | null
        daily_rate?: number | null
        amenities?: Json
        images?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        capacity?: number
        hourly_rate?: number | null
        daily_rate?: number | null
        amenities?: Json
        images?: Json
        is_active?: boolean
        created_at?: string
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
    venue_bookings: {
      Row: {
        id: string
        store_id: string
        venue_id: string
        customer_id: string | null
        event_type: string
        start_at: string
        end_at: string
        guests_count: number | null
        total_amount: number
        deposit_amount: number | null
        status: string
        special_requests: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        venue_id: string
        customer_id?: string | null
        event_type?: string
        start_at: string
        end_at: string
        guests_count?: number | null
        total_amount?: number
        deposit_amount?: number | null
        status?: string
        special_requests?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        venue_id?: string
        customer_id?: string | null
        event_type?: string
        start_at?: string
        end_at?: string
        guests_count?: number | null
        total_amount?: number
        deposit_amount?: number | null
        status?: string
        special_requests?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "venue_bookings_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    coworking_spaces: {
      Row: {
        id: string
        store_id: string
        name: string
        space_type: string
        capacity: number
        hourly_rate: number | null
        daily_rate: number | null
        monthly_rate: number | null
        amenities: Json
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        space_type?: string
        capacity?: number
        hourly_rate?: number | null
        daily_rate?: number | null
        monthly_rate?: number | null
        amenities?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        space_type?: string
        capacity?: number
        hourly_rate?: number | null
        daily_rate?: number | null
        monthly_rate?: number | null
        amenities?: Json
        is_active?: boolean
        created_at?: string
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
    desk_bookings: {
      Row: {
        id: string
        store_id: string
        space_id: string
        customer_id: string | null
        booking_date: string
        start_time: string | null
        end_time: string | null
        total_amount: number
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        space_id: string
        customer_id?: string | null
        booking_date: string
        start_time?: string | null
        end_time?: string | null
        total_amount?: number
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        space_id?: string
        customer_id?: string | null
        booking_date?: string
        start_time?: string | null
        end_time?: string | null
        total_amount?: number
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "desk_bookings_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "desk_bookings_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    // Phase 10: Legal + Construction + Subscription
    legal_cases: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        assigned_to: string | null
        case_number: string
        title: string
        case_type: string
        status: string
        priority: string
        description: string | null
        court_name: string | null
        filing_date: string | null
        next_hearing: string | null
        total_fees: number
        amount_paid: number
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        assigned_to?: string | null
        case_number: string
        title: string
        case_type?: string
        status?: string
        priority?: string
        description?: string | null
        court_name?: string | null
        filing_date?: string | null
        next_hearing?: string | null
        total_fees?: number
        amount_paid?: number
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        assigned_to?: string | null
        case_number?: string
        title?: string
        case_type?: string
        status?: string
        priority?: string
        description?: string | null
        court_name?: string | null
        filing_date?: string | null
        next_hearing?: string | null
        total_fees?: number
        amount_paid?: number
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "legal_cases_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "legal_cases_assigned_to_fkey"
          columns: ["assigned_to"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    case_documents: {
      Row: {
        id: string
        store_id: string
        case_id: string
        name: string
        document_type: string
        file_url: string | null
        file_size: number | null
        uploaded_by: string | null
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        case_id: string
        name: string
        document_type?: string
        file_url?: string | null
        file_size?: number | null
        uploaded_by?: string | null
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        case_id?: string
        name?: string
        document_type?: string
        file_url?: string | null
        file_size?: number | null
        uploaded_by?: string | null
        notes?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "case_documents_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "case_documents_case_id_fkey"
          columns: ["case_id"]
          isOneToOne: false
          referencedRelation: "legal_cases"
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
    projects: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        manager_id: string | null
        name: string
        description: string | null
        project_type: string
        status: string
        priority: string
        start_date: string | null
        end_date: string | null
        budget: number | null
        actual_cost: number
        completion_percentage: number
        location: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        manager_id?: string | null
        name: string
        description?: string | null
        project_type?: string
        status?: string
        priority?: string
        start_date?: string | null
        end_date?: string | null
        budget?: number | null
        actual_cost?: number
        completion_percentage?: number
        location?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        manager_id?: string | null
        name?: string
        description?: string | null
        project_type?: string
        status?: string
        priority?: string
        start_date?: string | null
        end_date?: string | null
        budget?: number | null
        actual_cost?: number
        completion_percentage?: number
        location?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "projects_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    project_tasks: {
      Row: {
        id: string
        store_id: string
        project_id: string
        assigned_to: string | null
        title: string
        description: string | null
        status: string
        priority: string
        due_date: string | null
        completed_at: string | null
        estimated_hours: number | null
        actual_hours: number | null
        sort_order: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        project_id: string
        assigned_to?: string | null
        title: string
        description?: string | null
        status?: string
        priority?: string
        due_date?: string | null
        completed_at?: string | null
        estimated_hours?: number | null
        actual_hours?: number | null
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        project_id?: string
        assigned_to?: string | null
        title?: string
        description?: string | null
        status?: string
        priority?: string
        due_date?: string | null
        completed_at?: string | null
        estimated_hours?: number | null
        actual_hours?: number | null
        sort_order?: number
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "project_tasks_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "project_tasks_assigned_to_fkey"
          columns: ["assigned_to"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    subscriptions: {
      Row: {
        id: string
        store_id: string
        customer_id: string
        plan_name: string
        billing_period: string
        amount: number
        status: string
        started_at: string
        next_billing_at: string | null
        cancelled_at: string | null
        expires_at: string | null
        auto_renew: boolean
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id: string
        plan_name: string
        billing_period?: string
        amount: number
        status?: string
        started_at?: string
        next_billing_at?: string | null
        cancelled_at?: string | null
        expires_at?: string | null
        auto_renew?: boolean
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string
        plan_name?: string
        billing_period?: string
        amount?: number
        status?: string
        started_at?: string
        next_billing_at?: string | null
        cancelled_at?: string | null
        expires_at?: string | null
        auto_renew?: boolean
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "subscriptions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "subscriptions_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    subscription_items: {
      Row: {
        id: string
        store_id: string
        subscription_id: string
        product_id: string | null
        service_id: string | null
        description: string
        quantity: number
        unit_price: number
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        subscription_id: string
        product_id?: string | null
        service_id?: string | null
        description: string
        quantity?: number
        unit_price: number
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        subscription_id?: string
        product_id?: string | null
        service_id?: string | null
        description?: string
        quantity?: number
        unit_price?: number
        created_at?: string
      }
      Relationships: [
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
      ]
    }
    // ============================================================
    // Phase 11: Sports/Gym + Repair Shop + Consulting
    // ============================================================
    fitness_classes: {
      Row: {
        id: string
        store_id: string
        instructor_id: string | null
        name: string
        description: string | null
        class_type: string
        capacity: number
        duration_minutes: number
        schedule: Json
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        instructor_id?: string | null
        name: string
        description?: string | null
        class_type?: string
        capacity?: number
        duration_minutes?: number
        schedule?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        instructor_id?: string | null
        name?: string
        description?: string | null
        class_type?: string
        capacity?: number
        duration_minutes?: number
        schedule?: Json
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "fitness_classes_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "fitness_classes_instructor_id_fkey"
          columns: ["instructor_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    class_bookings: {
      Row: {
        id: string
        store_id: string
        class_id: string
        customer_id: string | null
        booking_date: string
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        class_id: string
        customer_id?: string | null
        booking_date: string
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        class_id?: string
        customer_id?: string | null
        booking_date?: string
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "class_bookings_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    equipment: {
      Row: {
        id: string
        store_id: string
        name: string
        equipment_type: string
        serial_number: string | null
        status: string
        location: string | null
        purchase_date: string | null
        last_maintenance: string | null
        next_maintenance: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        equipment_type?: string
        serial_number?: string | null
        status?: string
        location?: string | null
        purchase_date?: string | null
        last_maintenance?: string | null
        next_maintenance?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        equipment_type?: string
        serial_number?: string | null
        status?: string
        location?: string | null
        purchase_date?: string | null
        last_maintenance?: string | null
        next_maintenance?: string | null
        notes?: string | null
        created_at?: string
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
    repair_orders: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        assigned_to: string | null
        order_number: string
        device_type: string
        brand: string | null
        model: string | null
        serial_number: string | null
        issue_description: string
        diagnosis: string | null
        status: string
        priority: string
        estimated_cost: number | null
        actual_cost: number | null
        deposit_amount: number | null
        received_at: string
        estimated_completion: string | null
        completed_at: string | null
        delivered_at: string | null
        warranty_until: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        assigned_to?: string | null
        order_number: string
        device_type?: string
        brand?: string | null
        model?: string | null
        serial_number?: string | null
        issue_description: string
        diagnosis?: string | null
        status?: string
        priority?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        deposit_amount?: number | null
        received_at?: string
        estimated_completion?: string | null
        completed_at?: string | null
        delivered_at?: string | null
        warranty_until?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        assigned_to?: string | null
        order_number?: string
        device_type?: string
        brand?: string | null
        model?: string | null
        serial_number?: string | null
        issue_description?: string
        diagnosis?: string | null
        status?: string
        priority?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        deposit_amount?: number | null
        received_at?: string
        estimated_completion?: string | null
        completed_at?: string | null
        delivered_at?: string | null
        warranty_until?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "repair_orders_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "repair_orders_assigned_to_fkey"
          columns: ["assigned_to"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    repair_parts: {
      Row: {
        id: string
        store_id: string
        repair_order_id: string
        name: string
        part_number: string | null
        quantity: number
        unit_cost: number
        supplier: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        repair_order_id: string
        name: string
        part_number?: string | null
        quantity?: number
        unit_cost?: number
        supplier?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        repair_order_id?: string
        name?: string
        part_number?: string | null
        quantity?: number
        unit_cost?: number
        supplier?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "repair_parts_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "repair_parts_repair_order_id_fkey"
          columns: ["repair_order_id"]
          isOneToOne: false
          referencedRelation: "repair_orders"
          referencedColumns: ["id"]
        },
      ]
    }
    consultations: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        consultant_id: string | null
        consultation_type: string
        scheduled_at: string
        duration_minutes: number
        status: string
        fee: number | null
        location: string | null
        meeting_url: string | null
        notes: string | null
        follow_up_date: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        consultant_id?: string | null
        consultation_type?: string
        scheduled_at: string
        duration_minutes?: number
        status?: string
        fee?: number | null
        location?: string | null
        meeting_url?: string | null
        notes?: string | null
        follow_up_date?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        consultant_id?: string | null
        consultation_type?: string
        scheduled_at?: string
        duration_minutes?: number
        status?: string
        fee?: number | null
        location?: string | null
        meeting_url?: string | null
        notes?: string | null
        follow_up_date?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "consultations_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "consultations_consultant_id_fkey"
          columns: ["consultant_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    // ============================================================
    // Phase 12: Home Services + Logistics + Restaurant Extensions
    // ============================================================
    service_requests: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        assigned_to: string | null
        request_number: string
        service_type: string
        address: string | null
        scheduled_at: string | null
        duration_estimate: number | null
        status: string
        priority: string
        estimated_cost: number | null
        actual_cost: number | null
        notes: string | null
        completed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        assigned_to?: string | null
        request_number: string
        service_type?: string
        address?: string | null
        scheduled_at?: string | null
        duration_estimate?: number | null
        status?: string
        priority?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        notes?: string | null
        completed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        assigned_to?: string | null
        request_number?: string
        service_type?: string
        address?: string | null
        scheduled_at?: string | null
        duration_estimate?: number | null
        status?: string
        priority?: string
        estimated_cost?: number | null
        actual_cost?: number | null
        notes?: string | null
        completed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "service_requests_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "service_requests_assigned_to_fkey"
          columns: ["assigned_to"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    service_areas: {
      Row: {
        id: string
        store_id: string
        name: string
        description: string | null
        zip_codes: string[] | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        description?: string | null
        zip_codes?: string[] | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        description?: string | null
        zip_codes?: string[] | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
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
    fleet_vehicles: {
      Row: {
        id: string
        store_id: string
        driver_id: string | null
        plate_number: string
        vehicle_type: string
        brand: string | null
        model: string | null
        year: number | null
        status: string
        insurance_expiry: string | null
        registration_expiry: string | null
        mileage: number | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        driver_id?: string | null
        plate_number: string
        vehicle_type?: string
        brand?: string | null
        model?: string | null
        year?: number | null
        status?: string
        insurance_expiry?: string | null
        registration_expiry?: string | null
        mileage?: number | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        driver_id?: string | null
        plate_number?: string
        vehicle_type?: string
        brand?: string | null
        model?: string | null
        year?: number | null
        status?: string
        insurance_expiry?: string | null
        registration_expiry?: string | null
        mileage?: number | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "fleet_vehicles_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "fleet_vehicles_driver_id_fkey"
          columns: ["driver_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    trip_logs: {
      Row: {
        id: string
        store_id: string
        vehicle_id: string
        driver_id: string | null
        start_location: string | null
        end_location: string | null
        start_time: string
        end_time: string | null
        distance_km: number | null
        fuel_cost: number | null
        status: string
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        vehicle_id: string
        driver_id?: string | null
        start_location?: string | null
        end_location?: string | null
        start_time: string
        end_time?: string | null
        distance_km?: number | null
        fuel_cost?: number | null
        status?: string
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        vehicle_id?: string
        driver_id?: string | null
        start_location?: string | null
        end_location?: string | null
        start_time?: string
        end_time?: string | null
        distance_km?: number | null
        fuel_cost?: number | null
        status?: string
        notes?: string | null
        created_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "trip_logs_driver_id_fkey"
          columns: ["driver_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    table_layouts: {
      Row: {
        id: string
        store_id: string
        name: string
        section: string | null
        capacity: number
        shape: string
        position_x: number
        position_y: number
        status: string
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        section?: string | null
        capacity?: number
        shape?: string
        position_x?: number
        position_y?: number
        status?: string
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        section?: string | null
        capacity?: number
        shape?: string
        position_x?: number
        position_y?: number
        status?: string
        is_active?: boolean
        created_at?: string
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
        id: string
        store_id: string
        table_id: string
        customer_id: string | null
        party_size: number
        reservation_time: string
        duration_minutes: number
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        table_id: string
        customer_id?: string | null
        party_size?: number
        reservation_time: string
        duration_minutes?: number
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        table_id?: string
        customer_id?: string | null
        party_size?: number
        reservation_time?: string
        duration_minutes?: number
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
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
        {
          foreignKeyName: "table_reservations_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Legal Extended -----
    time_entries: {
      Row: {
        id: string
        store_id: string
        case_id: string
        staff_id: string | null
        description: string
        hours: number
        billable_rate: number
        is_billable: boolean
        entry_date: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        case_id: string
        staff_id?: string | null
        description: string
        hours?: number
        billable_rate?: number
        is_billable?: boolean
        entry_date?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        case_id?: string
        staff_id?: string | null
        description?: string
        hours?: number
        billable_rate?: number
        is_billable?: boolean
        entry_date?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "time_entries_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    case_events: {
      Row: {
        id: string
        store_id: string
        case_id: string
        event_type: string
        title: string
        scheduled_at: string
        location: string | null
        outcome: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        case_id: string
        event_type?: string
        title: string
        scheduled_at: string
        location?: string | null
        outcome?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        case_id?: string
        event_type?: string
        title?: string
        scheduled_at?: string
        location?: string | null
        outcome?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "case_events_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "case_events_case_id_fkey"
          columns: ["case_id"]
          isOneToOne: false
          referencedRelation: "legal_cases"
          referencedColumns: ["id"]
        },
      ]
    }
    legal_expenses: {
      Row: {
        id: string
        store_id: string
        case_id: string
        expense_type: string
        description: string
        amount: number
        incurred_date: string
        is_billable: boolean
        receipt_url: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        case_id: string
        expense_type?: string
        description: string
        amount?: number
        incurred_date?: string
        is_billable?: boolean
        receipt_url?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        case_id?: string
        expense_type?: string
        description?: string
        amount?: number
        incurred_date?: string
        is_billable?: boolean
        receipt_url?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "legal_expenses_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "legal_expenses_case_id_fkey"
          columns: ["case_id"]
          isOneToOne: false
          referencedRelation: "legal_cases"
          referencedColumns: ["id"]
        },
      ]
    }
    retainers: {
      Row: {
        id: string
        store_id: string
        case_id: string
        client_id: string | null
        initial_amount: number
        current_balance: number
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        case_id: string
        client_id?: string | null
        initial_amount?: number
        current_balance?: number
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        case_id?: string
        client_id?: string | null
        initial_amount?: number
        current_balance?: number
        status?: string
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "retainers_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    // ----- Stay Extended (Phase 043) -----
    rate_plans: {
      Row: {
        id: string
        store_id: string
        unit_type: string | null
        name: string
        pricing_model: string
        base_price: number
        weekend_price: number | null
        seasonal_adjustments: Json
        min_stay: number
        max_stay: number | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        unit_type?: string | null
        name: string
        pricing_model?: string
        base_price: number
        weekend_price?: number | null
        seasonal_adjustments?: Json
        min_stay?: number
        max_stay?: number | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        unit_type?: string | null
        name?: string
        pricing_model?: string
        base_price?: number
        weekend_price?: number | null
        seasonal_adjustments?: Json
        min_stay?: number
        max_stay?: number | null
        is_active?: boolean
        created_at?: string
        updated_at?: string
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
    leases: {
      Row: {
        id: string
        store_id: string
        unit_id: string | null
        tenant_name: string
        tenant_phone: string | null
        tenant_email: string | null
        lease_start: string
        lease_end: string | null
        monthly_rent: number
        deposit_amount: number | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        unit_id?: string | null
        tenant_name: string
        tenant_phone?: string | null
        tenant_email?: string | null
        lease_start: string
        lease_end?: string | null
        monthly_rent: number
        deposit_amount?: number | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        unit_id?: string | null
        tenant_name?: string
        tenant_phone?: string | null
        tenant_email?: string | null
        lease_start?: string
        lease_end?: string | null
        monthly_rent?: number
        deposit_amount?: number | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
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
    // ----- Beauty / Retail Extended (Phase 044) -----
    loyalty_transactions: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        points: number
        transaction_type: string
        reference_type: string | null
        reference_id: string | null
        description: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        points: number
        transaction_type: string
        reference_type?: string | null
        reference_id?: string | null
        description?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        points?: number
        transaction_type?: string
        reference_type?: string | null
        reference_id?: string | null
        description?: string | null
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "loyalty_transactions_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "loyalty_transactions_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    package_purchases: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        package_id: string | null
        purchase_date: string
        sessions_total: number
        sessions_used: number
        expires_at: string | null
        status: string
        amount_paid: number | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        package_id?: string | null
        purchase_date?: string
        sessions_total: number
        sessions_used?: number
        expires_at?: string | null
        status?: string
        amount_paid?: number | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        package_id?: string | null
        purchase_date?: string
        sessions_total?: number
        sessions_used?: number
        expires_at?: string | null
        status?: string
        amount_paid?: number | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "package_purchases_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
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
      ]
    }
    gift_cards: {
      Row: {
        id: string
        store_id: string
        code: string
        initial_balance: number
        current_balance: number
        customer_id: string | null
        status: string
        expires_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        code: string
        initial_balance: number
        current_balance: number
        customer_id?: string | null
        status?: string
        expires_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        code?: string
        initial_balance?: number
        current_balance?: number
        customer_id?: string | null
        status?: string
        expires_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "gift_cards_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "gift_cards_customer_id_fkey"
          columns: ["customer_id"]
          isOneToOne: false
          referencedRelation: "customers"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Retail Extended (Phase 045) -----
    stock_transfers: {
      Row: {
        id: string
        store_id: string
        from_location_id: string | null
        to_location_id: string | null
        status: string
        initiated_by: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        from_location_id?: string | null
        to_location_id?: string | null
        status?: string
        initiated_by?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        from_location_id?: string | null
        to_location_id?: string | null
        status?: string
        initiated_by?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "stock_transfers_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "stock_transfers_from_location_id_fkey"
          columns: ["from_location_id"]
          isOneToOne: false
          referencedRelation: "inventory_locations"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "stock_transfers_to_location_id_fkey"
          columns: ["to_location_id"]
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
      ]
    }
    transfer_items: {
      Row: {
        id: string
        transfer_id: string
        product_id: string | null
        quantity: number
        received_quantity: number
        created_at: string
      }
      Insert: {
        id?: string
        transfer_id: string
        product_id?: string | null
        quantity: number
        received_quantity?: number
        created_at?: string
      }
      Update: {
        id?: string
        transfer_id?: string
        product_id?: string | null
        quantity?: number
        received_quantity?: number
        created_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "transfer_items_transfer_id_fkey"
          columns: ["transfer_id"]
          isOneToOne: false
          referencedRelation: "stock_transfers"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "transfer_items_product_id_fkey"
          columns: ["product_id"]
          isOneToOne: false
          referencedRelation: "products"
          referencedColumns: ["id"]
        },
      ]
    }
    // ----- Restaurant Extended (Phase 8b+) -----
    table_sessions: {
      Row: {
        id: string
        store_id: string
        table_id: string
        server_id: string | null
        guest_count: number
        seated_at: string
        closed_at: string | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        table_id: string
        server_id?: string | null
        guest_count: number
        seated_at?: string
        closed_at?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        table_id?: string
        server_id?: string | null
        guest_count?: number
        seated_at?: string
        closed_at?: string | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    kds_tickets: {
      Row: {
        id: string
        store_id: string
        station_id: string | null
        order_id: string | null
        table_session_id: string | null
        items: Json
        priority: number
        status: string
        started_at: string | null
        completed_at: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        station_id?: string | null
        order_id?: string | null
        table_session_id?: string | null
        items?: Json
        priority?: number
        status?: string
        started_at?: string | null
        completed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        station_id?: string | null
        order_id?: string | null
        table_session_id?: string | null
        items?: Json
        priority?: number
        status?: string
        started_at?: string | null
        completed_at?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    event_bookings: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        customer_name: string
        customer_phone: string
        customer_email: string | null
        event_type: string
        event_date: string
        event_start_time: string | null
        event_end_time: string | null
        guest_count: number
        venue_resource_id: string | null
        status: string
        budget_estimate: number | null
        quoted_amount: number | null
        final_amount: number | null
        special_requirements: string | null
        menu_selection: Json
        setup_notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        customer_name: string
        customer_phone: string
        customer_email?: string | null
        event_type?: string
        event_date: string
        event_start_time?: string | null
        event_end_time?: string | null
        guest_count: number
        venue_resource_id?: string | null
        status?: string
        budget_estimate?: number | null
        quoted_amount?: number | null
        final_amount?: number | null
        special_requirements?: string | null
        menu_selection?: Json
        setup_notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        customer_name?: string
        customer_phone?: string
        customer_email?: string | null
        event_type?: string
        event_date?: string
        event_start_time?: string | null
        event_end_time?: string | null
        guest_count?: number
        venue_resource_id?: string | null
        status?: string
        budget_estimate?: number | null
        quoted_amount?: number | null
        final_amount?: number | null
        special_requirements?: string | null
        menu_selection?: Json
        setup_notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    event_timeline: {
      Row: {
        id: string
        store_id: string
        event_booking_id: string
        milestone_type: string
        scheduled_at: string | null
        completed_at: string | null
        notes: string | null
        created_at: string
      }
      Insert: {
        id?: string
        store_id: string
        event_booking_id: string
        milestone_type: string
        scheduled_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        event_booking_id?: string
        milestone_type?: string
        scheduled_at?: string | null
        completed_at?: string | null
        notes?: string | null
        created_at?: string
      }
      Relationships: []
    }
    catering_orders: {
      Row: {
        id: string
        store_id: string
        customer_id: string | null
        customer_name: string
        customer_phone: string
        serving_date: string
        serving_time: string
        location_type: string
        address_text: string | null
        guest_count: number
        status: string
        quoted_amount: number | null
        final_amount: number | null
        logistics_notes: string | null
        equipment_needed: Json
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        customer_id?: string | null
        customer_name: string
        customer_phone: string
        serving_date: string
        serving_time: string
        location_type?: string
        address_text?: string | null
        guest_count: number
        status?: string
        quoted_amount?: number | null
        final_amount?: number | null
        logistics_notes?: string | null
        equipment_needed?: Json
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        customer_id?: string | null
        customer_name?: string
        customer_phone?: string
        serving_date?: string
        serving_time?: string
        location_type?: string
        address_text?: string | null
        guest_count?: number
        status?: string
        quoted_amount?: number | null
        final_amount?: number | null
        logistics_notes?: string | null
        equipment_needed?: Json
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    production_batches: {
      Row: {
        id: string
        store_id: string
        product_id: string | null
        production_date: string
        target_qty: number
        produced_qty: number
        cost_per_unit: number | null
        expiry_date: string | null
        status: string
        assigned_to: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        product_id?: string | null
        production_date: string
        target_qty: number
        produced_qty?: number
        cost_per_unit?: number | null
        expiry_date?: string | null
        status?: string
        assigned_to?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        product_id?: string | null
        production_date?: string
        target_qty?: number
        produced_qty?: number
        cost_per_unit?: number | null
        expiry_date?: string | null
        status?: string
        assigned_to?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: []
    }
    // ----- Construction Extended -----
    material_orders: {
      Row: {
        id: string
        store_id: string
        project_id: string
        supplier_name: string
        order_date: string
        expected_delivery: string | null
        status: string
        total_cost: number
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        project_id: string
        supplier_name: string
        order_date?: string
        expected_delivery?: string | null
        status?: string
        total_cost?: number
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        project_id?: string
        supplier_name?: string
        order_date?: string
        expected_delivery?: string | null
        status?: string
        total_cost?: number
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "material_orders_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "material_orders_project_id_fkey"
          columns: ["project_id"]
          isOneToOne: false
          referencedRelation: "projects"
          referencedColumns: ["id"]
        },
      ]
    }
    inspections: {
      Row: {
        id: string
        store_id: string
        project_id: string
        inspection_type: string
        inspector_name: string
        scheduled_date: string
        result: string
        required_corrections: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        project_id: string
        inspection_type?: string
        inspector_name: string
        scheduled_date: string
        result?: string
        required_corrections?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        project_id?: string
        inspection_type?: string
        inspector_name?: string
        scheduled_date?: string
        result?: string
        required_corrections?: string | null
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "inspections_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "inspections_project_id_fkey"
          columns: ["project_id"]
          isOneToOne: false
          referencedRelation: "projects"
          referencedColumns: ["id"]
        },
      ]
    }
    permits: {
      Row: {
        id: string
        store_id: string
        project_id: string
        permit_type: string
        permit_number: string | null
        issued_date: string | null
        expiry_date: string | null
        cost: number | null
        status: string
        notes: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        project_id: string
        permit_type?: string
        permit_number?: string | null
        issued_date?: string | null
        expiry_date?: string | null
        cost?: number | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        project_id?: string
        permit_type?: string
        permit_number?: string | null
        issued_date?: string | null
        expiry_date?: string | null
        cost?: number | null
        status?: string
        notes?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "permits_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
          referencedColumns: ["id"]
        },
        {
          foreignKeyName: "permits_project_id_fkey"
          columns: ["project_id"]
          isOneToOne: false
          referencedRelation: "projects"
          referencedColumns: ["id"]
        },
      ]
    }
    crew_members: {
      Row: {
        id: string
        store_id: string
        name: string
        role: string | null
        phone: string | null
        hourly_rate: number | null
        certifications: string[] | null
        status: string
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        name: string
        role?: string | null
        phone?: string | null
        hourly_rate?: number | null
        certifications?: string[] | null
        status?: string
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        name?: string
        role?: string | null
        phone?: string | null
        hourly_rate?: number | null
        certifications?: string[] | null
        status?: string
        created_at?: string
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
    daily_logs: {
      Row: {
        id: string
        store_id: string
        project_id: string
        log_date: string
        weather: string | null
        work_completed: string | null
        issues: string | null
        author_id: string | null
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        store_id: string
        project_id: string
        log_date?: string
        weather?: string | null
        work_completed?: string | null
        issues?: string | null
        author_id?: string | null
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        store_id?: string
        project_id?: string
        log_date?: string
        weather?: string | null
        work_completed?: string | null
        issues?: string | null
        author_id?: string | null
        created_at?: string
        updated_at?: string
      }
      Relationships: [
        {
          foreignKeyName: "daily_logs_store_id_fkey"
          columns: ["store_id"]
          isOneToOne: false
          referencedRelation: "stores"
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
          foreignKeyName: "daily_logs_author_id_fkey"
          columns: ["author_id"]
          isOneToOne: false
          referencedRelation: "staff"
          referencedColumns: ["id"]
        },
      ]
    }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
