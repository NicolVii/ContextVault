import { ChatView } from "@/components/ChatView";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CHAT_MODELS } from "@/lib/ai/models";

export default async function ChatPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let model = CHAT_MODELS[0].id;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_model")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.default_model) model = profile.default_model;
  }

  return <ChatView initialModel={model} />;
}
