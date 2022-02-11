class Const():
    #for troubleshooting, will migrate to own file
    data_dir = "../data/" #private data
    resource_dir = "../resources/" #public data (can be on github)
    pytorch_model_dir = resource_dir + "pytorch_models/"
    
    mdasi_folder = data_dir + "MDASI/"
    camprt_dir = data_dir + "CAMPRT_Centroids/"
    mdasi_centroid_dir = data_dir + 'MDASI_Distances/'
    organ_info_json = resource_dir + "OrganInfo.json"
    symptom_info_json = resource_dir + "symptoms.json"
    organ_model_dir = resource_dir + 'models/'
    
    #dict/python version will save as nan, otherwise np will be null for javascript
    processed_organ_json = data_dir + "patient_organ_data.json"
    denoised_organ_json = data_dir + "patient_organ_data_denoised.json"
    denoised_organ_array_dict = data_dir + 'patient_ddict.json'
    
    organ_similarity_results_json = data_dir + 'patient_organ_similarity.json'
    symptom_similarity_results_json = data_dir + 'patient_symptom_similarity.json'
    
    organ_svg_files = [ "../resources/" + 'hnc_organs_' + s + '.svg' for s in ['left','center','right']]
    
    organ_list = [
        'Esophagus',#
         'Spinal_Cord',#
         'Lt_Brachial_Plexus',
         'Rt_Brachial_Plexus',
         'Cricopharyngeal_Muscle',#
#          'Lt_thyroid_lobe',
#          'Rt_thyroid_lobe',
         'Cricoid_cartilage',#
         'IPC',#
         'MPC',#
         'Brainstem',#
         'Larynx',#
         'Thyroid_cartilage',#
         'Rt_Sternocleidomastoid_M',
         'Rt_Mastoid',
         'Rt_Parotid_Gland',
         'Rt_Medial_Pterygoid_M',
         'Rt_Lateral_Pterygoid_M',
         'Rt_Masseter_M',
         'Lt_Sternocleidomastoid_M',
         'Lt_Mastoid',
         'Lt_Parotid_Gland',
         'Lt_Submandibular_Gland',
         'Lt_Medial_Pterygoid_M',
         'Lt_Lateral_Pterygoid_M',
         'Lt_Masseter_M',
         'Supraglottic_Larynx',#
         'SPC',#
         'Rt_Submandibular_Gland',
         'Hyoid_bone',#
         'Soft_Palate',#
         'Genioglossus_M',#
         'Tongue',#
         'Rt_Ant_Digastric_M',
         'Lt_Ant_Digastric_M',
         'Mylogeniohyoid_M',#
         'Extended_Oral_Cavity',#
         'Mandible',#
         'Hard_Palate',
#          'Lt_Posterior_Seg_Eyeball',
#          'Rt_Posterior_Seg_Eyeball',
#          'Lt_Anterior_Seg_Eyeball',
#          'Rt_Anterior_Seg_Eyeball',
         'Lower_Lip',
         'Upper_Lip',
         'Glottic_Area',
                 ]
    
    swallow_organs = [
        'Cricopharyngeal_Muscle',
            'Esophagus',
            'IPC',
            'MPC',
            'SPC',
            'Mylogeniohyoid_M',
            'Supraglottic_Larynx',
             'Larynx',
            'Tongue',
            'Rt_Masseter_M',
            'Lt_Masseter_M',
             'Rt_Ant_Digastric_M',
             'Lt_Ant_Digastric_M',
        'Rt_Medial_Pterygoid_M',
             'Lt_Medial_Pterygoid_M',
             'Rt_Lateral_Pterygoid_M',
              'Lt_Lateral_Pterygoid_M',
        ]
    
    symptom_organ_map = {
        'swallow': [
        'Cricopharyngeal_Muscle',
#         'Esophagus',
        'IPC',
        'MPC',
        'SPC',
        'Mylogeniohyoid_M',
#         'Tongue',
        'Rt_Masseter_M',
        'Lt_Masseter_M',
        'Rt_Ant_Digastric_M',
        'Lt_Ant_Digastric_M',
        'Rt_Medial_Pterygoid_M',
         'Lt_Medial_Pterygoid_M',
         'Rt_Lateral_Pterygoid_M',
         'Lt_Lateral_Pterygoid_M',
        ],
        'cns': [
            'Brainstem',
            'Spinal_Cord',
            'Lt_Brachial_Plexus',
            'Rt_Brachial_Plexus',
            'Rt_Sternocleidomastoid_M',
            'Lt_Sternocleidomastoid_M',
        ],
        'mouth':[
            'Genioglossus_M',
            'Soft_Palate',
            'Hard_Palate',
            'Tongue',
            'Extended_Oral_Cavity',
        ],
        'throat': [
            'Supraglottic_Larynx',
             'Larynx',
            'Glottic_Area',
            'Hyoid_bone',
            'Thyroid_cartilage',
            'Cricopharyngeal_Muscle',
             'Cricoid_cartilage',
            'Esophagus',
        ]
    }
   
    symptoms = ["pain", "fatigue", "nausea", "sleep", 
                "distress", "sob", "memory", "appetite", 
                "drowsy", "drymouth", "sad", "vomit", "numb", 
                "mucus", "swallow", "choke", "voice", "skin", 
                "constipation", "taste", "mucositis", "teeth", 
                "activity", "mood", "work", "relations", "walking",
                "enjoy"]
    
    symptom_category_map = {
        'core': ['pain','fatigue','nausea','sleep',
                 "distress", "sob", "memory", "appetite", 
                "drowsy", "drymouth", "sad", "vomit", "numb"],
        'interference': ["activity", "mood", "work", 
                "relations", "walking","enjoy"],
        'hnc': ["mucus", "swallow", "choke", "voice", "skin", 
                "constipation", "taste", "mucositis", "teeth"],
    }
    
    symptom_domain_map = {
    'swallowing': ['swallow','choke','teeth'], #dysphagia and aspiration
    'salivary': ['drymouth','taste'], #xerostomia, saliva, taste
    'mucosal': ['mucositis','mucus'], #mucosoitis
    'speech': ['voice'], #hoarseness,
    'pain': ['pain'], #pain
    'general': [
        'fatigue','sleep','numb',
        'nausea','vomit','appetite',
        'mood','enjoy','sad','distress',
               ], #weight loss, nausea, vomiting fatigue
}