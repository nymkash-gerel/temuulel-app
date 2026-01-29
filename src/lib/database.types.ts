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
          api_key: string | null
          webhook_url: string | null
          webhook_secret: string | null
          webhook_events: Json
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
          api_key?: string | null
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_events?: Json
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
          api_key?: string | null
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_events?: Json
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
