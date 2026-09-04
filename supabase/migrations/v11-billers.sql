-- v11: teach merchant normalisation who the utilities are.
--
-- The v8 seed covered shops and apps but no utility providers, so a bank SMS
-- reading "DHBVN" stayed "Dhbvn" and never picked up a category. These rows
-- mirror src/lib/billers.ts — the biller picker and the email detector read
-- that file directly; this is the copy the SMS/merchant path needs.

insert into merchants (user_id, pattern, canonical, category) values
  -- ── Electricity ─────────────────────────────────────────────────────────
  (null, 'dhbvn',     'DHBVN (Dakshin Haryana)',   'Utilities & bills'),
  (null, 'uhbvn',     'UHBVN (Uttar Haryana)',     'Utilities & bills'),
  (null, 'pspcl',     'PSPCL (Punjab)',            'Utilities & bills'),
  (null, 'hpsebl',    'HPSEBL (Himachal Pradesh)', 'Utilities & bills'),
  (null, 'upcl',      'UPCL (Uttarakhand)',        'Utilities & bills'),
  (null, 'uppcl',     'UPPCL (Uttar Pradesh)',     'Utilities & bills'),
  (null, 'pvvnl',     'PVVNL (Meerut)',            'Utilities & bills'),
  (null, 'mvvnl',     'MVVNL (Lucknow)',           'Utilities & bills'),
  (null, 'puvvnl',    'PuVVNL (Varanasi)',         'Utilities & bills'),
  (null, 'dvvnl',     'DVVNL (Agra)',              'Utilities & bills'),
  (null, 'kesco',     'KESCO (Kanpur)',            'Utilities & bills'),
  (null, 'jvvnl',     'JVVNL (Jaipur)',            'Utilities & bills'),
  (null, 'avvnl',     'AVVNL (Ajmer)',             'Utilities & bills'),
  (null, 'jdvvnl',    'JdVVNL (Jodhpur)',          'Utilities & bills'),
  (null, 'bses',      'BSES',                      'Utilities & bills'),
  (null, 'tpddl',     'Tata Power Delhi (TPDDL)',  'Utilities & bills'),
  (null, 'msedcl',    'MSEDCL (Maharashtra)',      'Utilities & bills'),
  (null, 'mahadiscom','MSEDCL (Maharashtra)',      'Utilities & bills'),
  (null, 'torrent power', 'Torrent Power',         'Utilities & bills'),
  (null, 'dgvcl',     'DGVCL (South Gujarat)',     'Utilities & bills'),
  (null, 'mgvcl',     'MGVCL (Central Gujarat)',   'Utilities & bills'),
  (null, 'pgvcl',     'PGVCL (Paschim Gujarat)',   'Utilities & bills'),
  (null, 'ugvcl',     'UGVCL (Uttar Gujarat)',     'Utilities & bills'),
  (null, 'mppkvvcl',  'MP Paschim (Indore)',       'Utilities & bills'),
  (null, 'mpmkvvcl',  'MP Poorv (Jabalpur)',       'Utilities & bills'),
  (null, 'cspdcl',    'CSPDCL (Chhattisgarh)',     'Utilities & bills'),
  (null, 'wbsedcl',   'WBSEDCL (West Bengal)',     'Utilities & bills'),
  (null, 'nbpdcl',    'NBPDCL (North Bihar)',      'Utilities & bills'),
  (null, 'sbpdcl',    'SBPDCL (South Bihar)',      'Utilities & bills'),
  (null, 'jbvnl',     'JBVNL (Jharkhand)',         'Utilities & bills'),
  (null, 'tpcodl',    'TP Central Odisha (TPCODL)','Utilities & bills'),
  (null, 'tpnodl',    'TP Northern Odisha (TPNODL)','Utilities & bills'),
  (null, 'tpwodl',    'TP Western Odisha (TPWODL)','Utilities & bills'),
  (null, 'tpsodl',    'TP Southern Odisha (TPSODL)','Utilities & bills'),
  (null, 'apdcl',     'APDCL (Assam)',             'Utilities & bills'),
  (null, 'bescom',    'BESCOM (Bengaluru)',        'Utilities & bills'),
  (null, 'mescom',    'MESCOM (Mangaluru)',        'Utilities & bills'),
  (null, 'hescom',    'HESCOM (Hubballi)',         'Utilities & bills'),
  (null, 'gescom',    'GESCOM (Kalaburagi)',       'Utilities & bills'),
  (null, 'tangedco',  'TANGEDCO (Tamil Nadu)',     'Utilities & bills'),
  (null, 'kseb',      'KSEB (Kerala)',             'Utilities & bills'),
  (null, 'tgspdcl',   'TGSPDCL (South Telangana)', 'Utilities & bills'),
  (null, 'tsspdcl',   'TGSPDCL (South Telangana)', 'Utilities & bills'),
  (null, 'tgnpdcl',   'TGNPDCL (North Telangana)', 'Utilities & bills'),
  (null, 'apspdcl',   'APSPDCL (South AP)',        'Utilities & bills'),
  (null, 'apepdcl',   'APEPDCL (East AP)',         'Utilities & bills'),

  -- ── Piped gas ───────────────────────────────────────────────────────────
  (null, 'indraprastha gas', 'Indraprastha Gas (IGL)', 'Utilities & bills'),
  (null, 'mahanagar gas',    'Mahanagar Gas (MGL)',    'Utilities & bills'),
  (null, 'adani total gas',  'Adani Total Gas',        'Utilities & bills'),
  (null, 'gujarat gas',      'Gujarat Gas',            'Utilities & bills'),
  (null, 'haryana city gas', 'Haryana City Gas',       'Utilities & bills'),

  -- ── Water ───────────────────────────────────────────────────────────────
  (null, 'delhi jal board',  'Delhi Jal Board',        'Utilities & bills'),
  (null, 'bwssb',            'BWSSB (Bengaluru)',      'Utilities & bills'),
  (null, 'hmwssb',           'HMWSSB (Hyderabad)',     'Utilities & bills')
on conflict do nothing;
