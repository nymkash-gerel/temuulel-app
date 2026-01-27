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
