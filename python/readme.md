*Last updated: 8/4/2021*

##### Installation
This requires jupyter python 3 (I have 3.6).  Required packages can be installed with
```
pip install -r requirements.txt
```

#### SpatialPreprocessing.py
This repos assume certain things about the structure of the input data.
The class OrganData() in SpatialPreprocessing.py will read in the input data.  It currently assumes the form of the data will look like this:

```
/<Const.camprt_dir>/
	/<patient_id>/
		/<csv file with "centroid" in the title>
		/<csv file with "distance" in the title>
```
The current dir is defined in Constant.py in the class "Const"
Centroid files will contain a list of organs that were segmented, along with their centroid x, y and z position, and min, max and mean dose.  Currently, only the mean dose is extracted.
The distances file usually has some other information, which includes the original organ, the reference organ, and the minimum Euclidian distance between them.  The organs are not repeated, but the distinction between reference and target is arbitrary.

By default, the class OrganData will only consider organs that are predefined in the OrganInfo.json file in the resources folder, after accounting for some differences in naming conventions between datasets.  The list of organs selected from this will be set is OrganInfo.default_organs (this does not consider the left/right "positional modifiers", e.g. Eye_L and Eye_R would both be represented as "Eye".  Any organ with "GTV" in it will also be included after attempting to standardize the naming conventions (GTVp is the largest, GTVn -> GTVn2 ... are smaller).

After processing with OrganData().process_cohort_spatial_dict(load_spatial_files()), the result should be a json with the form 

```

{ 'organs': [ <Ordered list of the organs used when processing> }
	'patients': {
		{<Patient_id>: {
			{<organ_name or gtv_name> : {
				'volume': <organ volume>,
				'mean_dose': <mean dose in grays>
				'centroids': [<x>,<y>,<z>],
				'distances': [<distance(organ_name, organs[0])>, <distance(organ_name, organs[1]>, etc]
		},
		{<Patient_id>}: {<Patient Info} ...
	}
}
```
The order of the organs in "organs" will determine the order of distances in each organs 'distances' list.  GTVs are not included in this list, although they will have their own entries.
Values that are "missing" or that give an error will be filled in with "nan".  This is important to keep distinct from "0" for future processing.

#### Formatting.py

For processing an computationally efficient way, these need to be parsed into arrays.
Currently, the pipeline is designed to parse each "key" (e.g. volume, mean_dose, centroids, distances etc) into a matrix of shape:

<#Patients> x <#Organs> x <#values for each key> x <#timepoints>

Dimensions of length 1 are not included at time of writting.
For future reference we will call this a *feature array*
For using GTVs here, the values across all values are aggregated (aggfunc in get_spatial_gtv_array).  By default this is the minimum value for organ-tumor distances, total value for volume, and the value for the GTVp for other values.
A merged array with the aggregate GTV value appended to the second dimension is avaliable via the "merged_spatial_array" function, of shape

<#Patients> x <#Organs + GTV> x <#values for each key> x <#timepoints>

Order of the patients will be in sorted order.  Order for the organs is according to the "organs" file in the "organs" file

#### Autoencoders.py
The autoencoder uses pytorch to take a list of keys, and denoise them by passing them through a neural net that shrinks the dimensionality and attempts to reconstruct it.  During training it also adds dropout, so it learns to handle missing data.  The specific training ignores values with "nan" in the loss function.  The result is that any "nan" values are replaced.
As of writing there is an issue sometimes if ALL the values are nan.  this signifies an issue in the data.
The function "autoencode" will take the original data json, a list of "keys" for each organ to pass in the denoiser, and will return a dictionary of the form:
```
{
	<key>: 
		{'denoised': <feature_array(key)>,
		'original': <original_feature_array(key)>},
	 <key2>: {'denoised': <array>, 'original': <array>} , 
	 ...
 }
```
The "denoised" array should have no nan values
The autoencode function will train a neural net and then save it to the resources directory.  The naming is based on the keys and number of patients.  If a model with these same features is found, and the argument "training" is set to "True", it will load the pretrained model instead.  This assumes the organ list is the same.

#### Similarity.py <in progress>
This file will attempt to form metrics for measuring similarity between patients, assuming the patients are formatted as a *feature_array*