class Const():
    
    data_dir = "../data/"
    mdasi_file = data_dir + "MDASI_72021.xlsx"
    
    camprt_dir = data_dir + "CAMPRT_Centroids/"
    
    tumor_aliases = {'GTV node': 'GTVn',
                     'GTV-N': 'GTVn',
                     'GTV_n': 'GTVn',
                     'GTVn1': 'GTVn',
                     'GTV primary': 'GTVp',
                     'GTV-P': 'GTVp',
                     'GTV_p': 'GTVp',
                     'GTV_P': 'GTVp',
                     'GTV P': 'GTVp',
                     'GTV nodes': 'GTVn',
                     'GTV-N1': 'GTVn',
                     'GTV_N1': 'GTVn',
                     'GTV N': 'GTVn',
                     'GTV-NR': 'GTVn2', #I am only aware of this for 10144 and 10022, may need more robust solution later
                     'GTV-NL': 'GTVn3'
                     }