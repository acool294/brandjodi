import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { registerForPush } from "./push";
import { supabase } from "./supabase";

export interface CreatorProfile {
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  languages: string[];
  categories: string[];
  creator_types: string[];
  instagram_handle: string | null;
  instagram_followers: number | null;
  youtube_handle: string | null;
  youtube_subscribers: number | null;
  starting_price: number | null;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  metrics_verified: boolean;
}

interface AuthState {
  session: Session | null;
  profile: CreatorProfile | null;
  /** true until the first session + profile load finishes */
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", s.user.id)
      .maybeSingle();
    setProfile((data as CreatorProfile | null) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer DB calls out of the auth callback (supabase-js guidance).
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (session?.user.id) registerForPush(session.user.id);
  }, [session?.user.id]);

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile: () => loadProfile(session) }),
    [session, profile, loading, loadProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
