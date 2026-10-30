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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      Business: {
        Row: {
          createdAt: string
          email: string
          id: number
          industryType: string
          name: string
          phone: string
          timezone: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          id?: number
          industryType: string
          name: string
          phone: string
          timezone?: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          email?: string
          id?: number
          industryType?: string
          name?: string
          phone?: string
          timezone?: string
          updatedAt?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          center: unknown
          id: number
          name: string
          radius_m: number
          slug: string
          timezone: string
        }
        Insert: {
          center: unknown
          id?: never
          name: string
          radius_m: number
          slug: string
          timezone: string
        }
        Update: {
          center?: unknown
          id?: never
          name?: string
          radius_m?: number
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      Client: {
        Row: {
          address: string | null
          businessId: number
          companyName: string | null
          createdAt: string
          email: string | null
          firstName: string
          id: number
          lastJobAt: string | null
          lastName: string
          notes: string | null
          outstandingBalance: number
          phone: string
          status: string
          totalRevenue: number
          updatedAt: string
        }
        Insert: {
          address?: string | null
          businessId: number
          companyName?: string | null
          createdAt?: string
          email?: string | null
          firstName: string
          id?: number
          lastJobAt?: string | null
          lastName: string
          notes?: string | null
          outstandingBalance?: number
          phone: string
          status?: string
          totalRevenue?: number
          updatedAt: string
        }
        Update: {
          address?: string | null
          businessId?: number
          companyName?: string | null
          createdAt?: string
          email?: string | null
          firstName?: string
          id?: number
          lastJobAt?: string | null
          lastName?: string
          notes?: string | null
          outstandingBalance?: number
          phone?: string
          status?: string
          totalRevenue?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Client_businessId_fkey"
            columns: ["businessId"]
            isOneToOne: false
            referencedRelation: "Business"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_reads: {
        Row: {
          event_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_interests: {
        Row: {
          event_id: string
          interest_id: number
        }
        Insert: {
          event_id: string
          interest_id: number
        }
        Update: {
          event_id?: string
          interest_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      event_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          event_id: string
          id: number
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: never
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sources: {
        Row: {
          active: boolean
          city_id: number
          created_at: string
          default_interest_slugs: string[]
          default_lat: number | null
          default_lng: number | null
          default_venue_name: string | null
          id: string
          kind: string
          last_error: string | null
          last_run_at: string | null
          name: string
          url: string
        }
        Insert: {
          active?: boolean
          city_id: number
          created_at?: string
          default_interest_slugs?: string[]
          default_lat?: number | null
          default_lng?: number | null
          default_venue_name?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          name: string
          url: string
        }
        Update: {
          active?: boolean
          city_id?: number
          created_at?: string
          default_interest_slugs?: string[]
          default_lat?: number | null
          default_lng?: number | null
          default_venue_name?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          name?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sources_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_submissions: {
        Row: {
          address: string | null
          admin_note: string | null
          agent_fingerprint: string | null
          city_id: number
          created_at: string
          details: string | null
          ends_at: string | null
          event_id: string | null
          id: string
          image_url: string | null
          link: string | null
          origin: string
          reviewed_at: string | null
          source_handle: string | null
          starts_at: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_by: string | null
          title: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          admin_note?: string | null
          agent_fingerprint?: string | null
          city_id: number
          created_at?: string
          details?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          origin?: string
          reviewed_at?: string | null
          source_handle?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_by?: string | null
          title: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          admin_note?: string | null
          agent_fingerprint?: string | null
          city_id?: number
          created_at?: string
          details?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          origin?: string
          reviewed_at?: string | null
          source_handle?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_by?: string | null
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_submissions_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attribution: string | null
          city_id: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          ends_at: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_free: boolean
          location: unknown
          neighborhood: string | null
          price_max: number | null
          price_min: number | null
          source: Database["public"]["Enums"]["event_source"]
          starts_at: string
          status: string
          ticket_url: string | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          attribution?: string | null
          city_id: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          ends_at?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          location: unknown
          neighborhood?: string | null
          price_max?: number | null
          price_min?: number | null
          source: Database["public"]["Enums"]["event_source"]
          starts_at: string
          status?: string
          ticket_url?: string | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          attribution?: string | null
          city_id?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          ends_at?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          location?: unknown
          neighborhood?: string | null
          price_max?: number | null
          price_min?: number | null
          source?: Database["public"]["Enums"]["event_source"]
          starts_at?: string
          status?: string
          ticket_url?: string | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          created_at: string
          requested_by: string
          status: Database["public"]["Enums"]["friendship_status"]
          user_a: string
          user_b: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_a: string
          user_b: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          address_key: string
          created_at: string
          lat: number | null
          lng: number | null
        }
        Insert: {
          address_key: string
          created_at?: string
          lat?: number | null
          lng?: number | null
        }
        Update: {
          address_key?: string
          created_at?: string
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      interests: {
        Row: {
          id: number
          label: string
          slug: string
          sort: number
          symbol: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
          sort?: number
          symbol: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
          sort?: number
          symbol?: string
        }
        Relationships: []
      }
      Invoice: {
        Row: {
          amount: number
          businessId: number
          clientId: number
          createdAt: string
          dueDate: string
          id: number
          invoiceNumber: string
          issueDate: string
          jobId: number | null
          notes: string | null
          paidAmount: number
          paidDate: string | null
          status: string
          updatedAt: string
        }
        Insert: {
          amount: number
          businessId: number
          clientId: number
          createdAt?: string
          dueDate: string
          id?: number
          invoiceNumber: string
          issueDate: string
          jobId?: number | null
          notes?: string | null
          paidAmount?: number
          paidDate?: string | null
          status?: string
          updatedAt: string
        }
        Update: {
          amount?: number
          businessId?: number
          clientId?: number
          createdAt?: string
          dueDate?: string
          id?: number
          invoiceNumber?: string
          issueDate?: string
          jobId?: number | null
          notes?: string | null
          paidAmount?: number
          paidDate?: string | null
          status?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invoice_businessId_fkey"
            columns: ["businessId"]
            isOneToOne: false
            referencedRelation: "Business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_jobId_fkey"
            columns: ["jobId"]
            isOneToOne: false
            referencedRelation: "Job"
            referencedColumns: ["id"]
          },
        ]
      }
      Job: {
        Row: {
          address: string
          businessId: number
          clientId: number
          completedAt: string | null
          createdAt: string
          description: string | null
          finalAmount: number | null
          id: number
          internalNotes: string | null
          invoicedAt: string | null
          quotedAmount: number | null
          scheduledEnd: string | null
          scheduledStart: string
          status: string
          title: string
          updatedAt: string
        }
        Insert: {
          address: string
          businessId: number
          clientId: number
          completedAt?: string | null
          createdAt?: string
          description?: string | null
          finalAmount?: number | null
          id?: number
          internalNotes?: string | null
          invoicedAt?: string | null
          quotedAmount?: number | null
          scheduledEnd?: string | null
          scheduledStart: string
          status?: string
          title: string
          updatedAt: string
        }
        Update: {
          address?: string
          businessId?: number
          clientId?: number
          completedAt?: string | null
          createdAt?: string
          description?: string | null
          finalAmount?: number | null
          id?: number
          internalNotes?: string | null
          invoicedAt?: string | null
          quotedAmount?: number | null
          scheduledEnd?: string | null
          scheduledStart?: string
          status?: string
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Job_businessId_fkey"
            columns: ["businessId"]
            isOneToOne: false
            referencedRelation: "Business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Job_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
        ]
      }
      JobMedia: {
        Row: {
          caption: string | null
          createdAt: string
          id: number
          jobId: number
          url: string
        }
        Insert: {
          caption?: string | null
          createdAt?: string
          id?: number
          jobId: number
          url: string
        }
        Update: {
          caption?: string | null
          createdAt?: string
          id?: number
          jobId?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "JobMedia_jobId_fkey"
            columns: ["jobId"]
            isOneToOne: false
            referencedRelation: "Job"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          event_id: string | null
          id: number
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: never
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: never
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_interests: {
        Row: {
          interest_id: number
          profile_id: string
        }
        Insert: {
          interest_id: number
          profile_id: string
        }
        Update: {
          interest_id?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_interests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          home_city_id: number | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          home_city_id?: number | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          home_city_id?: number | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_private: {
        Row: {
          birthdate: string
          created_at: string
          discoverable_by_phone: boolean
          id: string
          phone_hmac: string | null
        }
        Insert: {
          birthdate: string
          created_at?: string
          discoverable_by_phone?: boolean
          id: string
          phone_hmac?: string | null
        }
        Update: {
          birthdate?: string
          created_at?: string
          discoverable_by_phone?: boolean
          id?: string
          phone_hmac?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ReminderMessage: {
        Row: {
          businessId: number
          clientId: number
          content: string
          createdAt: string
          id: number
          invoiceId: number | null
          jobId: number | null
          sentAt: string
          status: string
        }
        Insert: {
          businessId: number
          clientId: number
          content: string
          createdAt?: string
          id?: number
          invoiceId?: number | null
          jobId?: number | null
          sentAt?: string
          status?: string
        }
        Update: {
          businessId?: number
          clientId?: number
          content?: string
          createdAt?: string
          id?: number
          invoiceId?: number | null
          jobId?: number | null
          sentAt?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ReminderMessage_businessId_fkey"
            columns: ["businessId"]
            isOneToOne: false
            referencedRelation: "Business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ReminderMessage_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "Client"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: number
          reason: string
          reporter_id: string
          resolved_at: string | null
          snapshot_author_id: string | null
          snapshot_body: string | null
          snapshot_event_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason: string
          reporter_id: string
          resolved_at?: string | null
          snapshot_author_id?: string | null
          snapshot_body?: string | null
          snapshot_event_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          snapshot_author_id?: string | null
          snapshot_body?: string | null
          snapshot_event_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_snapshot_author_id_fkey"
            columns: ["snapshot_author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          created_at: string
          event_id: string
          friend_alert_sent_at: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          friend_alert_sent_at?: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          friend_alert_sent_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          businessId: number
          clerkId: string
          createdAt: string
          id: number
          role: string
        }
        Insert: {
          businessId: number
          clerkId: string
          createdAt?: string
          id?: number
          role?: string
        }
        Update: {
          businessId?: number
          clerkId?: string
          createdAt?: string
          id?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "User_businessId_fkey"
            columns: ["businessId"]
            isOneToOne: false
            referencedRelation: "Business"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      complete_onboarding: {
        Args: {
          p_birthdate: string
          p_display_name: string
          p_home_city_id: number
          p_interest_ids: number[]
          p_username: string
        }
        Returns: undefined
      }
      find_duplicate_event: {
        Args: {
          p_city_id: number
          p_exclude_source: Database["public"]["Enums"]["event_source"]
          p_lat: number
          p_lng: number
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      find_venue_location: {
        Args: { p_city_id: number; p_venue: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      get_chat_messages: {
        Args: { p_before_id?: number; p_event_id: string; p_limit?: number }
        Returns: {
          avatar_path: string
          body: string
          created_at: string
          display_name: string
          id: number
          is_mine: boolean
          user_id: string
        }[]
      }
      get_event_social: {
        Args: { p_event_id: string }
        Returns: {
          friends_going: Json
          going_count: number
          my_status: Database["public"]["Enums"]["rsvp_status"]
        }[]
      }
      get_feed: {
        Args: {
          p_city_id: number
          p_day: string
          p_interest_ids?: number[]
          p_lat: number
          p_lng: number
          p_mode?: string
          p_price?: string
          p_radius_m?: number
        }
        Returns: {
          distance_m: number
          ends_at: string
          friends_going: Json
          going_count: number
          id: string
          image_url: string
          interest_ids: number[]
          is_free: boolean
          lat: number
          lng: number
          my_status: Database["public"]["Enums"]["rsvp_status"]
          neighborhood: string
          price_min: number
          score: number
          starts_at: string
          title: string
          venue_name: string
        }[]
      }
      get_feed_range: {
        Args: {
          p_city_id: number
          p_days: number
          p_interest_ids?: number[]
          p_lat: number
          p_lng: number
          p_mode?: string
          p_price?: string
          p_radius_m?: number
          p_start: string
        }
        Returns: {
          day: string
          distance_m: number
          ends_at: string
          friends_going: Json
          going_count: number
          id: string
          image_url: string
          interest_ids: number[]
          is_free: boolean
          lat: number
          lng: number
          my_status: Database["public"]["Enums"]["rsvp_status"]
          neighborhood: string
          price_min: number
          score: number
          starts_at: string
          title: string
          venue_name: string
        }[]
      }
      get_my_chats: {
        Args: never
        Returns: {
          event_id: string
          going_count: number
          image_url: string
          is_open: boolean
          last_at: string
          last_author_name: string
          last_body: string
          starts_at: string
          title: string
          unread_count: number
        }[]
      }
      get_profile: {
        Args: { p_user: string }
        Returns: {
          avatar_path: string
          bio: string
          display_name: string
          friend_count: number
          friendship: string
          id: string
          mutual_friend_count: number
          shared_events: Json
          username: string
        }[]
      }
      list_friend_requests: {
        Args: never
        Returns: {
          avatar_path: string
          created_at: string
          direction: string
          display_name: string
          id: string
          username: string
        }[]
      }
      list_friends: {
        Args: never
        Returns: {
          avatar_path: string
          display_name: string
          id: string
          since: string
          username: string
        }[]
      }
      mark_chat_read: { Args: { p_event_id: string }; Returns: undefined }
      purge_old_reports: { Args: never; Returns: number }
      remove_friend: { Args: { p_user: string }; Returns: undefined }
      report_message: {
        Args: { p_message_id: number; p_reason: string }
        Returns: undefined
      }
      respond_friend_request: {
        Args: { p_accept: boolean; p_user: string }
        Returns: string
      }
      search_profiles: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_path: string
          display_name: string
          friendship: string
          id: string
          username: string
        }[]
      }
      send_friend_request: { Args: { p_user: string }; Returns: string }
      set_rsvp: {
        Args: {
          p_event_id: string
          p_status: Database["public"]["Enums"]["rsvp_status"]
        }
        Returns: undefined
      }
      submit_event: {
        Args: {
          p_city_id: number
          p_details: string
          p_link: string
          p_starts_at: string
          p_title: string
          p_venue: string
        }
        Returns: string
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
    }
    Enums: {
      event_source: "ticketmaster" | "seatgeek" | "curated" | "ical" | "serpapi" | "agent"
      friendship_status: "pending" | "accepted"
      rsvp_status: "interested" | "down_if_friends" | "going"
      submission_status: "pending" | "approved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_source: ["ticketmaster", "seatgeek", "curated", "ical", "serpapi", "agent"],
      friendship_status: ["pending", "accepted"],
      rsvp_status: ["interested", "down_if_friends", "going"],
      submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
