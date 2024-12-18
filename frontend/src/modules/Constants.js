
//replace this with website.evl.uic.edu/api/ if deploying n an evl server
export const API_URL = 'http://127.0.0.1:8000/';//this is a bad way to do this.  Whatever the flask server is set to

export const ORGANS_TO_SHOW = ['Esophagus',
'Spinal_Cord',
'Lt_Brachial_Plexus',
'Rt_Brachial_Plexus',
'Cricopharyngeal_Muscle',
// 'Lt_thyroid_lobe',
// 'Rt_thyroid_lobe',
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
// 'Lt_Posterior_Seg_Eyeball',
// 'Rt_Posterior_Seg_Eyeball',
// 'Lt_Anterior_Seg_Eyeball',
// 'Rt_Anterior_Seg_Eyeball',
'Lower_Lip',
'Upper_Lip',
'Glottic_Area',
        ]

export const ORGAN_NAME_MAP = {
    "Cricoid": "Cricoid_cartilage",
    'Musc_Digastric_LA': 'Lt_Ant_Digastric_M',
    'Musc_Digastric_RA': 'Rt_Ant_Digastric_M',
    'Bone_Hyoid': 'Hyoid_bone',
    'Bone_Mastoid_R': 'Rt_Mastoid',
    'Bone_Mastoid_L': 'Lt_Mastoid',
    'Brachial_Plex_R': 'Rt_Brachial_Plexus',
    'Brachial_Plex_L': 'Lt_Brachial_Plexus',
    'Cartlg_Thyroid': 'Thyroid_cartilage',
    'Cricoid': 'Cricoid_cartilage',
    'Cricopharyngeus': 'Cricopharyngeal_Muscle',
    'Esophagus_U': 'Esophagus',
    'Eye_R': 'Rt_Posterior_Seg_Eyeball',
    'Eye_L': 'Lt_Posterior_Seg_Eyeball',
    'Glnd_Submand_R': 'Rt_Submandibular_Gland',
    'Glnd_Submand_L': 'Lt_Submandibular_Gland',
    'Hardpalate': 'Hard_Palate',
    'Larynx_SG': 'Supraglottic_Larynx',
    'Lens_R': 'Rt_Anterior_Seg_Eyeball',
    'Lens_L': 'Lt_Anterior_Seg_Eyeball',
    'Lips_Lower': 'Lower_Lip',
    'Lips_Upper': 'Upper_Lip',
    'Musc_Constrict_I': 'IPC',
    'Musc_Constrict_M': 'MPC',
    'Musc_Constrict_S': 'SPC',
    'Musc_Geniogloss': 'Genioglossus_M',
    'Musc_Masseter_R': 'Rt_Masseter_M',
    'Musc_Masseter_L': 'Lt_Masseter_M',
    'Musc_Sclmast_R': 'Rt_Sternocleidomastoid_M',
    'Musc_Sclmast_L': 'Lt_Sternocleidomastoid_M',
    'Oral_Cavity': 'Extended_Oral_Cavity',
    'Palate_Soft': 'Soft_Palate',
    'Parotid_R': 'Rt_Parotid_Gland',
    'Parotid_L': 'Lt_Parotid_Gland',
    'Pterygoid_Lat_R': 'Rt_Lateral_Pterygoid_M',
    'Pterygoid_Lat_L': 'Lt_Lateral_Pterygoid_M',
    'Pterygoid_Med_R': 'Rt_Medial_Pterygoid_M',
    'Pterygoid_Med_L': 'Lt_Medial_Pterygoid_M',
    'SpinalCord_Cerv': 'Spinal_Cord',
    'GLottic_Area': 'Glottic_Area',
}

export const ORGAN_RENDER_ORDER = {
    "Tongue": -10,
    "Genioglossus_M": -10,
    "Lt_Ant_Digastric_M": -10,
    "Rt_Ant_Digastric_M": -10,
    "Mylogeniohyoid_M": -10,
    "Extended_Oral_Cavity": -9,
    "Larynx": -10,
    "Suppraglottic_Larynx": -9
}

export const DVH_KEYS = ['mean_dose','max_dose','V5','V10','V15','V20','V25','V30','V35','V40','V45','V50','V55','V60','V65','V70','V75','V80']