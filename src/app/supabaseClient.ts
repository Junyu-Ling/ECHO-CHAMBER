import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, publicAnonKey);
