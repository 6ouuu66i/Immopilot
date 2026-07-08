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
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          agency_id: string
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          payload: Json | null
          property_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          agency_id: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          payload?: Json | null
          property_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          agency_id?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          payload?: Json | null
          property_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          ipi_number: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          subscription_plan: string
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ipi_number?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          subscription_plan?: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ipi_number?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          subscription_plan?: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      agency_invitations: {
        Row: {
          accepted_at: string | null
          agency_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          agency_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string
          created_at: string
          id: string
          ip_address: unknown
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id: string
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agency_id: string
          agent_id: string
          amount: number
          created_at: string
          created_by: string
          deal_id: string
          id: string
          notes: string | null
          paid_at: string | null
          percentage: number | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          agent_id: string
          amount: number
          created_at?: string
          created_by: string
          deal_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          amount?: number
          created_at?: string
          created_by?: string
          deal_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_properties: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          property_id: string
          relationship: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          property_id: string
          relationship?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          property_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_properties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "contact_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "contact_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          last_interaction_at: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          reference: string | null
          roles: string[]
          source: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_interaction_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          reference?: string | null
          roles?: string[]
          source?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_interaction_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          reference?: string | null
          roles?: string[]
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agency_id: string
          closed_at: string | null
          contact_id: string | null
          created_at: string
          estimated_commission: number | null
          expected_close_date: string | null
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          lost_reason: string | null
          notes: string | null
          owner_id: string
          property_id: string
          reference: string | null
          stage_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          estimated_commission?: number | null
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          lost_reason?: string | null
          notes?: string | null
          owner_id: string
          property_id: string
          reference?: string | null
          stage_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          estimated_commission?: number | null
          expected_close_date?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string
          property_id?: string
          reference?: string | null
          stage_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_outcomes: {
        Row: {
          band_at_outcome: string | null
          id: number
          meta: Json | null
          occurred_at: string
          outcome: string
          property_id: string
          score_at_outcome: number | null
          source: string
        }
        Insert: {
          band_at_outcome?: string | null
          id?: never
          meta?: Json | null
          occurred_at?: string
          outcome: string
          property_id: string
          score_at_outcome?: number | null
          source: string
        }
        Update: {
          band_at_outcome?: string | null
          id?: never
          meta?: Json | null
          occurred_at?: string
          outcome?: string
          property_id?: string
          score_at_outcome?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_outcomes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_outcomes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_outcomes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_score_history: {
        Row: {
          band: string
          breakdown: Json
          computed_at: string
          confidence: string
          id: number
          property_id: string
          score: number
          score_version: number
        }
        Insert: {
          band: string
          breakdown: Json
          computed_at?: string
          confidence: string
          id?: never
          property_id: string
          score: number
          score_version: number
        }
        Update: {
          band?: string
          breakdown?: Json
          computed_at?: string
          confidence?: string
          id?: never
          property_id?: string
          score?: number
          score_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_score_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_score_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_score_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_score_history_score_version_fkey"
            columns: ["score_version"]
            isOneToOne: false
            referencedRelation: "scoring_versions"
            referencedColumns: ["score_version"]
          },
        ]
      }
      listing_scores: {
        Row: {
          band: string
          breakdown: Json
          computed_at: string
          confidence: string
          confidence_detail: Json
          confidence_score: number
          families_count: number
          property_id: string
          raw_score: number
          score: number
          score_version: number
          signals_count: number
        }
        Insert: {
          band: string
          breakdown: Json
          computed_at?: string
          confidence: string
          confidence_detail: Json
          confidence_score: number
          families_count: number
          property_id: string
          raw_score: number
          score: number
          score_version: number
          signals_count: number
        }
        Update: {
          band?: string
          breakdown?: Json
          computed_at?: string
          confidence?: string
          confidence_detail?: Json
          confidence_score?: number
          families_count?: number
          property_id?: string
          raw_score?: number
          score?: number
          score_version?: number
          signals_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_scores_score_version_fkey"
            columns: ["score_version"]
            isOneToOne: false
            referencedRelation: "scoring_versions"
            referencedColumns: ["score_version"]
          },
        ]
      }
      listing_signals: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          is_active: boolean
          listing_id: string
          metadata: Json
          property_id: string
          resolved_at: string | null
          signal_type: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          is_active?: boolean
          listing_id: string
          metadata?: Json
          property_id: string
          resolved_at?: string | null
          signal_type: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          is_active?: boolean
          listing_id?: string
          metadata?: Json
          property_id?: string
          resolved_at?: string | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_signals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_signals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "listing_signals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listing_signals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          agency_name: string | null
          ai_badges: string[] | null
          ai_estimated_rent: number | null
          ai_gross_yield: number | null
          ai_score: number | null
          ai_summary: string | null
          bookmark_count: number | null
          co2_emission: number | null
          construction_year: number | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_type: string | null
          description_fr: string | null
          description_nl: string | null
          epc_consumption: number | null
          epc_score: string | null
          first_seen_at: string
          flood_zone: string | null
          floor: number | null
          garden_surface: number | null
          has_garden: boolean | null
          has_lift: boolean | null
          has_swimming_pool: boolean | null
          has_terrace: boolean | null
          id: string
          ipi_number: string | null
          is_fsbo: boolean | null
          is_furnished: boolean | null
          is_life_annuity: boolean | null
          is_new_build: boolean | null
          is_public_sale: boolean | null
          is_under_option: boolean | null
          last_seen_at: string
          monthly_costs: number | null
          old_price: number | null
          parking_indoor: number | null
          parking_outdoor: number | null
          photo_urls: string[] | null
          price: number | null
          price_type: string | null
          property_id: string | null
          published_at: string | null
          raw_data: Json | null
          removed_at: string | null
          source: string
          source_id: string
          status: string
          terrace_surface: number | null
          title_fr: string | null
          title_nl: string | null
          transaction_type: string
          updated_at: string
          updated_at_source: string | null
          url: string | null
          view_count: number | null
        }
        Insert: {
          agency_name?: string | null
          ai_badges?: string[] | null
          ai_estimated_rent?: number | null
          ai_gross_yield?: number | null
          ai_score?: number | null
          ai_summary?: string | null
          bookmark_count?: number | null
          co2_emission?: number | null
          construction_year?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          description_fr?: string | null
          description_nl?: string | null
          epc_consumption?: number | null
          epc_score?: string | null
          first_seen_at?: string
          flood_zone?: string | null
          floor?: number | null
          garden_surface?: number | null
          has_garden?: boolean | null
          has_lift?: boolean | null
          has_swimming_pool?: boolean | null
          has_terrace?: boolean | null
          id?: string
          ipi_number?: string | null
          is_fsbo?: boolean | null
          is_furnished?: boolean | null
          is_life_annuity?: boolean | null
          is_new_build?: boolean | null
          is_public_sale?: boolean | null
          is_under_option?: boolean | null
          last_seen_at?: string
          monthly_costs?: number | null
          old_price?: number | null
          parking_indoor?: number | null
          parking_outdoor?: number | null
          photo_urls?: string[] | null
          price?: number | null
          price_type?: string | null
          property_id?: string | null
          published_at?: string | null
          raw_data?: Json | null
          removed_at?: string | null
          source: string
          source_id: string
          status?: string
          terrace_surface?: number | null
          title_fr?: string | null
          title_nl?: string | null
          transaction_type?: string
          updated_at?: string
          updated_at_source?: string | null
          url?: string | null
          view_count?: number | null
        }
        Update: {
          agency_name?: string | null
          ai_badges?: string[] | null
          ai_estimated_rent?: number | null
          ai_gross_yield?: number | null
          ai_score?: number | null
          ai_summary?: string | null
          bookmark_count?: number | null
          co2_emission?: number | null
          construction_year?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          description_fr?: string | null
          description_nl?: string | null
          epc_consumption?: number | null
          epc_score?: string | null
          first_seen_at?: string
          flood_zone?: string | null
          floor?: number | null
          garden_surface?: number | null
          has_garden?: boolean | null
          has_lift?: boolean | null
          has_swimming_pool?: boolean | null
          has_terrace?: boolean | null
          id?: string
          ipi_number?: string | null
          is_fsbo?: boolean | null
          is_furnished?: boolean | null
          is_life_annuity?: boolean | null
          is_new_build?: boolean | null
          is_public_sale?: boolean | null
          is_under_option?: boolean | null
          last_seen_at?: string
          monthly_costs?: number | null
          old_price?: number | null
          parking_indoor?: number | null
          parking_outdoor?: number | null
          photo_urls?: string[] | null
          price?: number | null
          price_type?: string | null
          property_id?: string | null
          published_at?: string | null
          raw_data?: Json | null
          removed_at?: string | null
          source?: string
          source_id?: string
          status?: string
          terrace_surface?: number | null
          title_fr?: string | null
          title_nl?: string | null
          transaction_type?: string
          updated_at?: string
          updated_at_source?: string | null
          url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          agency_id: string
          author_id: string
          contact_id: string | null
          content: string
          created_at: string
          deal_id: string | null
          id: string
          property_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          author_id: string
          contact_id?: string | null
          content: string
          created_at?: string
          deal_id?: string | null
          id?: string
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          author_id?: string
          contact_id?: string | null
          content?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          property_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          read_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          agency_id: string
          color: string | null
          created_at: string
          id: string
          is_default: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
        }
        Insert: {
          agency_id: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          position: number
        }
        Update: {
          agency_id?: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          change_amount: number | null
          change_percentage: number | null
          change_type: string
          created_at: string
          detected_at: string
          id: string
          listing_id: string | null
          new_price: number
          old_price: number | null
          property_id: string
          source: string | null
        }
        Insert: {
          change_amount?: number | null
          change_percentage?: number | null
          change_type?: string
          created_at?: string
          detected_at?: string
          id?: string
          listing_id?: string | null
          new_price: number
          old_price?: number | null
          property_id: string
          source?: string | null
        }
        Update: {
          change_amount?: number | null
          change_percentage?: number | null
          change_type?: string
          created_at?: string
          detected_at?: string
          id?: string
          listing_id?: string | null
          new_price?: number
          old_price?: number | null
          property_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["listing_id"]
          },
          {
            foreignKeyName: "price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "price_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          ipi_number: string | null
          is_active: boolean
          notification_preferences: Json
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          ipi_number?: string | null
          is_active?: boolean
          notification_preferences?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          ipi_number?: string | null
          is_active?: boolean
          notification_preferences?: Json
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_key: string | null
          bathroom_count: number | null
          bedroom_count: number | null
          country: string | null
          created_at: string
          house_number: string | null
          id: string
          land_area: number | null
          latitude: number | null
          living_area: number | null
          locality: string | null
          longitude: number | null
          postal_code: string | null
          property_subtype: string | null
          property_type: string | null
          province: string | null
          region: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          address_key?: string | null
          bathroom_count?: number | null
          bedroom_count?: number | null
          country?: string | null
          created_at?: string
          house_number?: string | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          living_area?: number | null
          locality?: string | null
          longitude?: number | null
          postal_code?: string | null
          property_subtype?: string | null
          property_type?: string | null
          province?: string | null
          region?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          address_key?: string | null
          bathroom_count?: number | null
          bedroom_count?: number | null
          country?: string | null
          created_at?: string
          house_number?: string | null
          id?: string
          land_area?: number | null
          latitude?: number | null
          living_area?: number | null
          locality?: string | null
          longitude?: number | null
          postal_code?: string | null
          property_subtype?: string | null
          property_type?: string | null
          province?: string | null
          region?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reference_counters: {
        Row: {
          agency_id: string
          current_value: number
          entity_type: string
        }
        Insert: {
          agency_id: string
          current_value?: number
          entity_type: string
        }
        Update: {
          agency_id?: string
          current_value?: number
          entity_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_counters_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_config: {
        Row: {
          exclusive_group: string | null
          family_key: string
          half_life_days: number | null
          is_active: boolean
          max_points: number
          mult_agency: number
          mult_fsbo: number
          reason_template_fr: string
          signal_key: string
          signal_kind: string
          updated_at: string
        }
        Insert: {
          exclusive_group?: string | null
          family_key: string
          half_life_days?: number | null
          is_active?: boolean
          max_points: number
          mult_agency?: number
          mult_fsbo?: number
          reason_template_fr: string
          signal_key: string
          signal_kind: string
          updated_at?: string
        }
        Update: {
          exclusive_group?: string | null
          family_key?: string
          half_life_days?: number | null
          is_active?: boolean
          max_points?: number
          mult_agency?: number
          mult_fsbo?: number
          reason_template_fr?: string
          signal_key?: string
          signal_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_config_family_key_fkey"
            columns: ["family_key"]
            isOneToOne: false
            referencedRelation: "scoring_families"
            referencedColumns: ["family_key"]
          },
        ]
      }
      scoring_families: {
        Row: {
          display_rank: number
          family_cap: number
          family_key: string
          label_fr: string
        }
        Insert: {
          display_rank: number
          family_cap: number
          family_key: string
          label_fr: string
        }
        Update: {
          display_rank?: number
          family_cap?: number
          family_key?: string
          label_fr?: string
        }
        Relationships: []
      }
      scoring_versions: {
        Row: {
          changelog: string
          effective_from: string
          score_version: number
        }
        Insert: {
          changelog: string
          effective_from?: string
          score_version: number
        }
        Update: {
          changelog?: string
          effective_from?: string
          score_version?: number
        }
        Relationships: []
      }
      scrape_runs: {
        Row: {
          created_at: string
          error_message: string | null
          errors_count: number | null
          finished_at: string | null
          id: string
          listings_created: number | null
          listings_found: number | null
          listings_removed: number | null
          listings_updated: number | null
          price_changes_detected: number | null
          run_type: string
          source: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          errors_count?: number | null
          finished_at?: string | null
          id?: string
          listings_created?: number | null
          listings_found?: number | null
          listings_removed?: number | null
          listings_updated?: number | null
          price_changes_detected?: number | null
          run_type: string
          source: string
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          errors_count?: number | null
          finished_at?: string | null
          id?: string
          listings_created?: number | null
          listings_found?: number | null
          listings_removed?: number | null
          listings_updated?: number | null
          price_changes_detected?: number | null
          run_type?: string
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agency_id: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          owner_id: string
          priority: string | null
          property_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          owner_id: string
          priority?: string | null
          property_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          owner_id?: string
          priority?: string | null
          property_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          agency_id: string
          created_at: string
          deal_id: string
          from_agent_id: string
          id: string
          message: string | null
          refusal_reason: string | null
          requested_by: string
          resolved_at: string | null
          status: string
          to_agent_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          deal_id: string
          from_agent_id: string
          id?: string
          message?: string | null
          refusal_reason?: string | null
          requested_by: string
          resolved_at?: string | null
          status?: string
          to_agent_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          deal_id?: string
          from_agent_id?: string
          id?: string
          message?: string | null
          refusal_reason?: string | null
          requested_by?: string
          resolved_at?: string | null
          status?: string
          to_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_property_marks: {
        Row: {
          created_at: string
          id: string
          mark_type: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mark_type: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mark_type?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_marks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "user_property_marks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "user_property_marks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_marks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_properties_canonical: {
        Row: {
          ai_badges: string[] | null
          ai_gross_yield: number | null
          ai_summary: string | null
          bathroom_count: number | null
          bedroom_count: number | null
          canonical_property_id: string | null
          days_online: number | null
          first_seen_at: string | null
          has_price_drop: boolean | null
          has_republished_signal: boolean | null
          house_number: string | null
          is_fsbo: boolean | null
          land_area: number | null
          last_seen_at: string | null
          listing_id: string | null
          living_area: number | null
          locality: string | null
          old_price: number | null
          postal_code: string | null
          price: number | null
          primary_photo_url: string | null
          property_id: string | null
          property_subtype: string | null
          property_type: string | null
          province: string | null
          published_at: string | null
          seller_score: number | null
          source: string | null
          status: string | null
          street: string | null
          surface_value: number | null
          title_fr: string | null
          title_nl: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      active_properties_canonical_mat: {
        Row: {
          ai_badges: string[] | null
          ai_gross_yield: number | null
          ai_summary: string | null
          bathroom_count: number | null
          bedroom_count: number | null
          canonical_property_id: string | null
          days_online: number | null
          first_seen_at: string | null
          has_price_drop: boolean | null
          has_republished_signal: boolean | null
          house_number: string | null
          is_fsbo: boolean | null
          land_area: number | null
          last_seen_at: string | null
          listing_id: string | null
          living_area: number | null
          locality: string | null
          old_price: number | null
          postal_code: string | null
          price: number | null
          primary_photo_url: string | null
          property_id: string | null
          property_subtype: string | null
          property_type: string | null
          province: string | null
          published_at: string | null
          seller_score: number | null
          source: string | null
          status: string | null
          street: string | null
          surface_value: number | null
          title_fr: string | null
          title_nl: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "active_properties_canonical_mat"
            referencedColumns: ["canonical_property_id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_reference: {
        Row: {
          avg_price_per_m2: number | null
          computed_at: string | null
          median_price_per_m2: number | null
          postal_code: string | null
          property_type: string | null
          sample_size: number | null
          transaction_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      compute_listing_confidence: {
        Args: { p_property_id: string }
        Returns: {
          confidence: string
          confidence_score: number
          detail: Json
        }[]
      }
      compute_listing_scores: { Args: never; Returns: undefined }
      create_default_pipeline_stages: {
        Args: { p_agency_id: string }
        Returns: undefined
      }
      current_agency_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      generate_reference: {
        Args: { p_agency_id: string; p_entity_type: string }
        Returns: string
      }
      get_dashboard_snapshot: {
        Args: { p_opportunities_limit?: number }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      notify_scan_complete: { Args: never; Returns: undefined }
      purge_listing_score_history: {
        Args: { retention_days?: number }
        Returns: number
      }
      refresh_active_properties_canonical: { Args: never; Returns: undefined }
      refresh_market_reference: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_agency_mandate_aging_signal: { Args: never; Returns: undefined }
      sync_competition_shock_signal_batch: { Args: never; Returns: undefined }
      sync_daily_pipeline: { Args: never; Returns: undefined }
      sync_failed_launch_signal_batch: { Args: never; Returns: undefined }
      sync_overpriced_signal_batch: { Args: never; Returns: undefined }
      sync_stale_dom_relative_signal_batch: { Args: never; Returns: undefined }
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
