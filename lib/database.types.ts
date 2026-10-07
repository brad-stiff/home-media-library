export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row extends Record<string, unknown>, RequiredKeys extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredKeys>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          display_name: string | null;
          appearance: string;
          hide_movies: boolean;
          hide_books: boolean;
          hide_mtg: boolean;
          library_view: Json;
          created_at: string;
        },
        'id'
      >;
      households: Table<
        {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          show_movies: boolean;
          show_books: boolean;
          show_mtg: boolean;
          lending_enabled: boolean;
          created_at: string;
        },
        'invite_code' | 'created_by'
      >;
      household_members: Table<
        {
          household_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        },
        'household_id' | 'user_id' | 'role'
      >;
      movies: Table<
        {
          id: string;
          household_id: string;
          tmdb_id: number;
          title: string;
          year: string | null;
          poster_path: string | null;
          backdrop_path: string | null;
          overview: string | null;
          runtime: number | null;
          genres: string[];
          has_bluray: boolean;
          has_4k: boolean;
          has_digital: boolean;
          platform: string | null;
          barcode: string | null;
          added_by: string | null;
          added_by_name: string | null;
          created_at: string;
          updated_at: string;
        },
        'household_id' | 'tmdb_id' | 'title'
      >;
      books: Table<
        {
          id: string;
          household_id: string;
          isbn: string | null;
          title: string;
          authors: string[];
          year: string | null;
          cover_url: string | null;
          overview: string | null;
          open_library_key: string | null;
          added_by: string | null;
          added_by_name: string | null;
          created_at: string;
          updated_at: string;
        },
        'household_id' | 'title'
      >;
      checkouts: Table<
        {
          id: string;
          household_id: string;
          item_type: string;
          item_id: string;
          contact_id: string | null;
          borrower_name: string;
          checked_out_at: string;
          returned_at: string | null;
          cancelled_at: string | null;
          checked_out_by: string | null;
          notes: string | null;
        },
        'household_id' | 'item_type' | 'item_id' | 'borrower_name'
      >;
      mtg_cards: Table<
        {
          id: string;
          household_id: string;
          scryfall_id: string;
          oracle_id: string | null;
          name: string;
          set_code: string | null;
          set_name: string | null;
          collector_number: string | null;
          mana_cost: string | null;
          type_line: string | null;
          rarity: string | null;
          image_uri: string | null;
          back_image_uri: string | null;
          back_resolved: boolean;
          qty: number;
          foil: boolean;
          color_identity: string | null;
          added_by: string | null;
          added_by_name: string | null;
          created_at: string;
          updated_at: string;
        },
        'household_id' | 'scryfall_id' | 'name'
      >;
      mtg_decks: Table<
        {
          id: string;
          household_id: string;
          name: string;
          description: string | null;
          format: string;
          archidekt_id: string | null;
          created_by: string | null;
          created_by_name: string | null;
          created_at: string;
          updated_at: string;
        },
        'household_id' | 'name'
      >;
      mtg_deck_cards: Table<
        {
          id: string;
          deck_id: string;
          scryfall_id: string;
          oracle_id: string | null;
          name: string;
          image_uri: string | null;
          mana_cost: string | null;
          type_line: string | null;
          qty: number;
          category: string;
          is_commander: boolean;
          board: string;
          foil: boolean;
          color_identity: string | null;
          oracle_text: string | null;
          keywords: string[];
          standard_legality: string | null;
        },
        'deck_id' | 'scryfall_id' | 'name'
      >;
      contacts: Table<
        {
          id: string;
          household_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          sms_reminders: boolean;
          linked_user_id: string | null;
          app_invited_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        'household_id' | 'name'
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_invite_code: { Args: Record<string, never>; Returns: string };
      set_household_lending: { Args: { p_enabled: boolean }; Returns: undefined };
      set_household_media: {
        Args: { p_show_movies: boolean; p_show_books: boolean; p_show_mtg: boolean };
        Returns: undefined;
      };
      household_library_summary: { Args: Record<string, never>; Returns: Json };
      create_household: { Args: { p_name: string }; Returns: string };
      update_household_name: { Args: { new_name: string }; Returns: undefined };
      regenerate_invite_code: { Args: Record<string, never>; Returns: string };
      join_household: { Args: { p_code: string; p_force?: boolean }; Returns: undefined };
      leave_household: { Args: { p_acknowledge?: boolean }; Returns: undefined };
      set_member_role: { Args: { p_user_id: string; p_role: string }; Returns: undefined };
      remove_household_member: { Args: { p_user_id: string }; Returns: undefined };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
      save_contact: {
        Args: {
          p_contact_id: string | null;
          p_name: string;
          p_email: string | null;
          p_phone: string | null;
          p_sms_reminders: boolean;
        };
        Returns: Database['public']['Tables']['contacts']['Row'];
      };
      delete_contact: { Args: { p_contact_id: string }; Returns: undefined };
      mark_contact_app_invite: {
        Args: { p_contact_id: string };
        Returns: Database['public']['Tables']['contacts']['Row'];
      };
      checkout_item: {
        Args: {
          p_item_type: string;
          p_item_id: string;
          p_contact_id: string;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['checkouts']['Row'];
      };
      return_item: {
        Args: { p_checkout_id: string };
        Returns: Database['public']['Tables']['checkouts']['Row'];
      };
      cancel_checkout: {
        Args: { p_checkout_id: string };
        Returns: Database['public']['Tables']['checkouts']['Row'];
      };
      update_checkout_borrower: {
        Args: { p_checkout_id: string; p_contact_id: string };
        Returns: Database['public']['Tables']['checkouts']['Row'];
      };
      fill_mtg_color_identities: { Args: { p_cards: Json }; Returns: number };
      fill_mtg_card_backs: { Args: { p_cards: Json }; Returns: number };
    };
  };
};

export type Tables<Name extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][Name]['Row'];
