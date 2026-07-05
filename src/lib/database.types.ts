export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          ipi_number: string | null;
          logo_url: string | null;
          name: string;
          phone: string | null;
          postal_code: string | null;
          slug: string;
          subscription_plan: 'trial' | 'starter' | 'pro' | 'agency';
          subscription_status: 'active' | 'paused' | 'cancelled';
          trial_ends_at: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          ipi_number?: string | null;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          postal_code?: string | null;
          slug: string;
          subscription_plan?: 'trial' | 'starter' | 'pro' | 'agency';
          subscription_status?: 'active' | 'paused' | 'cancelled';
          trial_ends_at?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          ipi_number?: string | null;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          postal_code?: string | null;
          slug?: string;
          subscription_plan?: 'trial' | 'starter' | 'pro' | 'agency';
          subscription_status?: 'active' | 'paused' | 'cancelled';
          trial_ends_at?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      agency_invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: 'admin' | 'agent';
          status: 'pending' | 'accepted' | 'expired' | 'cancelled';
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          agency_id: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          role?: 'admin' | 'agent';
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          agency_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: 'admin' | 'agent';
          status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
          token?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          agency_id: string;
          created_at: string;
          id: string;
          ip_address: string | null;
          payload: Json | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          agency_id: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          payload?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          agency_id?: string;
          created_at?: string;
          id?: string;
          ip_address?: string | null;
          payload?: Json | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          agency_id: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          last_interaction_at: string | null;
          notes: string | null;
          owner_id: string | null;
          phone: string | null;
          reference: string | null;
          roles: string[];
          source: string | null;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          last_interaction_at?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          reference?: string | null;
          roles?: string[];
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          last_interaction_at?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          reference?: string | null;
          roles?: string[];
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_properties: {
        Row: {
          contact_id: string;
          created_at: string;
          id: string;
          property_id: string;
          relationship: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          id?: string;
          property_id: string;
          relationship: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          id?: string;
          property_id?: string;
          relationship?: string;
        };
        Relationships: [];
      };
      commissions: {
        Row: {
          agency_id: string;
          agent_id: string;
          amount: number;
          created_at: string;
          created_by: string;
          deal_id: string;
          id: string;
          notes: string | null;
          paid_at: string | null;
          percentage: number | null;
          status: 'draft' | 'expected' | 'payable' | 'paid' | 'cancelled';
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          agent_id: string;
          amount: number;
          created_at?: string;
          created_by: string;
          deal_id: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          percentage?: number | null;
          status?: 'draft' | 'expected' | 'payable' | 'paid' | 'cancelled';
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          agent_id?: string;
          amount?: number;
          created_at?: string;
          created_by?: string;
          deal_id?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string | null;
          percentage?: number | null;
          status?: 'draft' | 'expected' | 'payable' | 'paid' | 'cancelled';
          updated_at?: string;
        };
        Relationships: [];
      };
      deals: {
        Row: {
          agency_id: string;
          closed_at: string | null;
          contact_id: string | null;
          created_at: string;
          estimated_commission: number | null;
          expected_close_date: string | null;
          id: string;
          is_lost: boolean | null;
          is_won: boolean | null;
          lost_reason: string | null;
          notes: string | null;
          owner_id: string;
          property_id: string;
          reference: string | null;
          stage_id: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          closed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          estimated_commission?: number | null;
          expected_close_date?: string | null;
          id?: string;
          is_lost?: boolean | null;
          is_won?: boolean | null;
          lost_reason?: string | null;
          notes?: string | null;
          owner_id: string;
          property_id: string;
          reference?: string | null;
          stage_id: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          closed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          estimated_commission?: number | null;
          expected_close_date?: string | null;
          id?: string;
          is_lost?: boolean | null;
          is_won?: boolean | null;
          lost_reason?: string | null;
          notes?: string | null;
          owner_id?: string;
          property_id?: string;
          reference?: string | null;
          stage_id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          agency_id: string;
          color: string | null;
          created_at: string;
          id: string;
          is_default: boolean;
          is_lost: boolean;
          is_won: boolean;
          name: string;
          position: number;
        };
        Insert: {
          agency_id: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          is_lost?: boolean;
          is_won?: boolean;
          name: string;
          position: number;
        };
        Update: {
          agency_id?: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          is_lost?: boolean;
          is_won?: boolean;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          actor_id: string | null;
          agency_id: string;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          id: string;
          payload: Json | null;
          property_id: string | null;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          agency_id: string;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          payload?: Json | null;
          property_id?: string | null;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          agency_id?: string;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          payload?: Json | null;
          property_id?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          agency_id: string;
          completed_at: string | null;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          is_completed: boolean;
          owner_id: string;
          priority: string | null;
          property_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          completed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_completed?: boolean;
          owner_id: string;
          priority?: string | null;
          property_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          completed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_completed?: boolean;
          owner_id?: string;
          priority?: string | null;
          property_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          agency_name: string | null;
          ai_badges: string[] | null;
          ai_estimated_rent: number | null;
          ai_gross_yield: number | null;
          ai_score: number | null;
          ai_summary: string | null;
          created_at: string;
          customer_email: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_type: string | null;
          description_fr: string | null;
          description_nl: string | null;
          first_seen_at: string;
          id: string;
          ipi_number: string | null;
          is_fsbo: boolean | null;
          is_furnished: boolean | null;
          is_life_annuity: boolean | null;
          is_new_build: boolean | null;
          is_public_sale: boolean | null;
          last_seen_at: string;
          old_price: number | null;
          photo_urls: string[] | null;
          price: number | null;
          price_type: string | null;
          property_id: string | null;
          published_at: string | null;
          raw_data: Json | null;
          removed_at: string | null;
          source: string;
          source_id: string;
          status: string;
          title_fr: string | null;
          title_nl: string | null;
          transaction_type: string;
          updated_at: string;
          updated_at_source: string | null;
          url: string | null;
        };
      };
      properties: {
        Row: {
          address_key: string | null;
          bathroom_count: number | null;
          bedroom_count: number | null;
          country: string | null;
          created_at: string;
          house_number: string | null;
          id: string;
          land_area: number | null;
          latitude: number | null;
          living_area: number | null;
          locality: string | null;
          longitude: number | null;
          postal_code: string | null;
          property_subtype: string | null;
          property_type: string | null;
          province: string | null;
          region: string | null;
          street: string | null;
          updated_at: string;
        };
      };
      notes: {
        Row: {
          agency_id: string;
          author_id: string;
          contact_id: string | null;
          content: string;
          created_at: string;
          deal_id: string | null;
          id: string;
          property_id: string | null;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          author_id: string;
          contact_id?: string | null;
          content: string;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          property_id?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          author_id?: string;
          contact_id?: string | null;
          content?: string;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          property_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          metadata: Json | null;
          read_at: string | null;
          related_id: string | null;
          related_type: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          metadata?: Json | null;
          read_at?: string | null;
          related_id?: string | null;
          related_type?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          metadata?: Json | null;
          read_at?: string | null;
          related_id?: string | null;
          related_type?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transfer_requests: {
        Row: {
          agency_id: string;
          created_at: string;
          deal_id: string;
          from_agent_id: string;
          id: string;
          message: string | null;
          refusal_reason: string | null;
          requested_by: string;
          resolved_at: string | null;
          status: 'pending' | 'accepted' | 'refused' | 'cancelled';
          to_agent_id: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          deal_id: string;
          from_agent_id: string;
          id?: string;
          message?: string | null;
          refusal_reason?: string | null;
          requested_by: string;
          resolved_at?: string | null;
          status?: 'pending' | 'accepted' | 'refused' | 'cancelled';
          to_agent_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          deal_id?: string;
          from_agent_id?: string;
          id?: string;
          message?: string | null;
          refusal_reason?: string | null;
          requested_by?: string;
          resolved_at?: string | null;
          status?: 'pending' | 'accepted' | 'refused' | 'cancelled';
          to_agent_id?: string;
        };
        Relationships: [];
      };
      user_property_marks: {
        Row: {
          created_at: string;
          id: string;
          mark_type: 'favorite' | 'ignored';
          property_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mark_type: 'favorite' | 'ignored';
          property_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mark_type?: 'favorite' | 'ignored';
          property_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          agency_id: string | null;
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          ipi_number: string | null;
          is_active: boolean;
          notification_preferences: Json;
          phone: string | null;
          role: 'admin' | 'agent';
          updated_at: string;
        };
        Insert: {
          agency_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          ipi_number?: string | null;
          is_active?: boolean;
          notification_preferences?: Json;
          phone?: string | null;
          role?: 'admin' | 'agent';
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          ipi_number?: string | null;
          is_active?: boolean;
          notification_preferences?: Json;
          phone?: string | null;
          role?: 'admin' | 'agent';
          updated_at?: string;
        };
        Relationships: [];
      };
      reference_counters: {
        Row: {
          agency_id: string;
          current_value: number;
          entity_type: 'deal' | 'contact';
        };
      };
    };
    Views: {
      active_properties_canonical: {
        Row: {
          ai_badges: string[] | null;
          ai_gross_yield: number | null;
          ai_summary: string | null;
          bathroom_count: number | null;
          bedroom_count: number | null;
          canonical_property_id: string | null;
          days_online: number;
          first_seen_at: string;
          has_price_drop: boolean;
          has_republished_signal: boolean;
          house_number: string | null;
          is_fsbo: boolean | null;
          land_area: number | null;
          last_seen_at: string;
          listing_id: string;
          living_area: number | null;
          locality: string | null;
          old_price: number | null;
          postal_code: string | null;
          price: number | null;
          primary_photo_url: string | null;
          property_id: string | null;
          property_subtype: string | null;
          property_type: string | null;
          province: string | null;
          published_at: string | null;
          seller_score: number | null;
          source: string;
          status: string;
          street: string | null;
          surface_value: number | null;
          title_fr: string | null;
          title_nl: string | null;
          url: string | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<TableName extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][TableName]['Row'];
export type TablesInsert<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName] extends { Insert: infer Insert } ? Insert : never;
export type TablesUpdate<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName] extends { Update: infer Update } ? Update : never;
