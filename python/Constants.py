class Const():
    #for troubleshooting, will migrate to own file
    data_dir = "../data/" #private data
    resource_dir = "../resources/" #public data (can be on github)
    pytorch_model_dir = resource_dir + "pytorch_models/"
    
    mdasi_file = data_dir + "MDASI_72021.xlsx"
    camprt_dir = data_dir + "CAMPRT_Centroids/"
    
    organ_info_json = resource_dir + "OrganInfo.json"
    symptom_info_json = resource_dir + "symptoms.json"
    
    processed_organ_json = data_dir + "patient_organ_data.json"