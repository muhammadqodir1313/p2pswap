CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  need text NOT NULL,
  quality text NOT NULL DEFAULT 'balanced',
  note text NOT NULL DEFAULT '',
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_recommendations_created_at_idx ON public.ai_recommendations (created_at DESC);
CREATE INDEX ai_recommendations_user_id_idx ON public.ai_recommendations (user_id);

GRANT SELECT, INSERT ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own ai recommendations" ON public.ai_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read own ai recommendations or admin" ON public.ai_recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
