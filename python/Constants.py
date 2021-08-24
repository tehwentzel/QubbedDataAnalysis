class Const():
    #for troubleshooting, will migrate to own file
    data_dir = "../data/" #private data
    resource_dir = "../resources/" #public data (can be on github)
    pytorch_model_dir = resource_dir + "pytorch_models/"
    
    mdasi_folder = data_dir + "MDASI/"
    camprt_dir = data_dir + "CAMPRT_Centroids/"
    
    organ_info_json = resource_dir + "OrganInfo.json"
    symptom_info_json = resource_dir + "symptoms.json"
    organ_model_dir = resource_dir + 'models/'
    
    processed_organ_json = data_dir + "patient_organ_data.json"
    camprt_organs = ['Esophagus',
         'Spinal_Cord',
         'Lt_Brachial_Plexus',
         'Rt_Brachial_Plexus',
         'Cricopharyngeal_Muscle',
         'Lt_thyroid_lobe',
         'Rt_thyroid_lobe',
         'Cricoid_cartilage',
         'IPC',
         'MPC',
         'Brainstem',
         'Larynx',
         'Thyroid_cartilage',
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
         'Supraglottic_Larynx',
         'SPC',
         'Rt_Submandibular_Gland',
         'Hyoid_bone',
         'Soft_Palate',
         'Genioglossus_M',
         'Tongue',
         'Rt_Ant_Digastric_M',
         'Lt_Ant_Digastric_M',
         'Mylogeniohyoid_M',
         'Extended_Oral_Cavity',
         'Mandible',
         'Hard_Palate',
         'Lt_Posterior_Seg_Eyeball',
         'Rt_Posterior_Seg_Eyeball',
         'Lt_Anterior_Seg_Eyeball',
         'Rt_Anterior_Seg_Eyeball',
         'Lower_Lip',
         'Upper_Lip']
    
    symptoms = ["pain", "fatigue", "nausea", "sleep", 
                "distress", "sob", "memory", "appetite", 
                "drowsy", "drymouth", "sad", "vomit", "numb", 
                "mucus", "swallow", "choke", "voice", "skin", 
                "constipation", "taste", "mucositis", "teeth", 
                "activity", "mood", "work", "relations", "walking",
                "enjoy"]