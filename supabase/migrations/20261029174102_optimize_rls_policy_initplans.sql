ALTER POLICY documents_owner_all ON public.documents
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY sources_owner_all ON public.sources
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY versions_owner_all ON public.document_versions
  USING (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_versions.document_id
      AND d.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_versions.document_id
      AND d.user_id = (SELECT auth.uid())
  ));

ALTER POLICY doc_sources_owner_all ON public.document_sources
  USING (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_sources.document_id
      AND d.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_sources.document_id
      AND d.user_id = (SELECT auth.uid())
  ));

ALTER POLICY insights_owner_all ON public.document_insights
  USING (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_insights.document_id
      AND d.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_insights.document_id
      AND d.user_id = (SELECT auth.uid())
  ));

ALTER POLICY embeddings_owner_all ON public.document_embeddings
  USING (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_embeddings.document_id
      AND d.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents AS d
    WHERE d.id = document_embeddings.document_id
      AND d.user_id = (SELECT auth.uid())
  ));
