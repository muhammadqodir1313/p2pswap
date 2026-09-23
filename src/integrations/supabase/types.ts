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
      ai_recommendations: {
        Row: {
          created_at: string
          id: string
          need: string
          note: string
          quality: string
          recommendations: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          need: string
          note?: string
          quality?: string
          recommendations?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          need?: string
          note?: string
          quality?: string
          recommendations?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_slots: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_online: boolean
          kind: string
          owner_id: string
          partner_id: string | null
          peerpoint_cost: number
          skill: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          is_online?: boolean
          kind?: string
          owner_id: string
          partner_id?: string | null
          peerpoint_cost?: number
          skill?: string
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_online?: boolean
          kind?: string
          owner_id?: string
          partner_id?: string | null
          peerpoint_cost?: number
          skill?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_slots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_slots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string
          created_at: string
          id: string
          rating: number
          session_id: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          rating: number
          session_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "swap_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      peercoin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peercoin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peercoin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          is_demo: boolean
          last_name: string
          peercoins: number
          plan: string
          week_start: string
          weekly_points_used: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          first_name?: string
          id: string
          is_active?: boolean
          is_demo?: boolean
          last_name?: string
          peercoins?: number
          plan?: string
          week_start?: string
          weekly_points_used?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          is_demo?: boolean
          last_name?: string
          peercoins?: number
          plan?: string
          week_start?: string
          weekly_points_used?: number
        }
        Relationships: []
      }
      swap_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          partner_id: string
          partner_teaches: string
          requester_id: string
          requester_teaches: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          partner_id: string
          partner_teaches?: string
          requester_id: string
          requester_teaches?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          partner_teaches?: string
          requester_id?: string
          requester_teaches?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_sessions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_sessions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string
          id: string
          kind: string
          skill: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          skill: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          skill?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "peer_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      peer_directory: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          is_active: boolean | null
          is_demo: boolean | null
          last_name: string | null
          learn: string[] | null
          teach: string[] | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_demo?: boolean | null
          last_name?: string | null
          learn?: never
          teach?: never
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string | null
          is_active?: boolean | null
          is_demo?: boolean | null
          last_name?: string | null
          learn?: never
          teach?: never
        }
        Relationships: []
      }
    }
    Functions: {
      complete_session: { Args: { _session_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_calendar_slot: {
        Args: { _slot_id: string }
        Returns: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_online: boolean
          kind: string
          owner_id: string
          partner_id: string | null
          peerpoint_cost: number
          skill: string
          starts_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "calendar_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_weekly_points: {
        Args: { _user_id: string }
        Returns: {
          allowance: number
          plan: string
          used: number
          week_start: string
        }[]
      }
      set_calendar_slot_status: {
        Args: { _slot_id: string; _status: string }
        Returns: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_online: boolean
          kind: string
          owner_id: string
          partner_id: string | null
          peerpoint_cost: number
          skill: string
          starts_at: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "calendar_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_profile_active: {
        Args: { _active: boolean; _user_id: string }
        Returns: undefined
      }
      spend_peerpoint: { Args: never; Returns: number }
      weekly_allowance_for: { Args: { _plan: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
