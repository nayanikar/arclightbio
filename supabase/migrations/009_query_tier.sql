alter table opportunity_objects
  add column if not exists query_tier text default 'clinical';

update opportunity_objects set query_tier = case
  when search_query ilike '%exosome%'
    or search_query ilike '%microRNA%ALS%'
    or search_query ilike '%mitochondrial replacement%'
    or search_query ilike '%circular RNA%'
    or search_query ilike '%telomere%aging%'
  then 'preclinical'
  when search_query ilike '%trastuzumab%HER2%'
    or search_query ilike '%pembrolizumab%first line%'
    or search_query ilike '%checkpoint%NSCLC%approved%'
  then 'established'
  else 'clinical'
end;
