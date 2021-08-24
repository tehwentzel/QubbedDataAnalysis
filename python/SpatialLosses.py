import math
import torch
import numpy as np
from torch.nn import functional as F
from torch import nn


torch.set_default_dtype(torch.float32)

def _assert_no_grad(variables):
    for var in variables:
        assert not var.requires_grad, \
            "nn criterions don't compute the gradient w.r.t. targets - please " \
            "mark these variables as volatile or not requiring gradients"


def cdist(x, y):
    '''
    Input: x is a Nxd Tensor
           y is a Mxd Tensor
    Output: dist is a NxM matrix where dist[i,j] is the norm
           between x[i,:] and y[j,:]
    i.e. dist[i,j] = ||x[i,:]-y[j,:]||
    '''
    differences = x.unsqueeze(1) - y.unsqueeze(0)
    distances = torch.sum(differences**2, -1).sqrt()
    return distances

def haussdorf(x,y):
    d2_matrix = cdist(x, y)

    # Modified Chamfer Loss
    term_1 = torch.mean(torch.min(d2_matrix, 1)[0])
    term_2 = torch.mean(torch.min(d2_matrix, 0)[0])

    res = term_1 + term_2
    return res

def min_distance_loss(x,y,d):
    d2 = torch.min(cdist(x,y))
    l = torch.abs(d2 - d)/torch.abs(d + 1)
    return l**.5

def centroid_loss(cloud, centroid):
    cld_center = cloud.mean(axis=0)
    return torch.norm(cld_center - centroid)

def shape_loss(cloud, reference, volume):
    #idk so I'm going to estimate standard deviation as a radius?
    #this should probably be scaled somehow, I think
    hdorf = haussdorf(cloud,reference)
    size = torch.norm(reference.std(axis=0))
    return hdorf/size
#     variance = cloud.var(axis=0)*4
#     return torch.norm(variance/volume)
    
    
def pcloud_loss(cloud,default_clouds,centroids,vols,dists,sw,cw,dw, max_d_threshold = 300):
    #measures goodness of the pointcloud based on 3 factors
    #inter-organ distances via min pointwise distance (weight: dw), based on nearby organs
    #if the centroid of the pointcloud is by the centroid of the organ (weight: cw)
    #if the shape of the pointcloud is good (sw) - currently haussdorff distance to orginal cloud
    dist_losses = torch.zeros(cloud.shape[0]*cloud.shape[1]*cloud.shape[1]).float()
    shape_losses = torch.zeros(cloud.shape[0]*cloud.shape[1]).float()
    centroid_losses = torch.zeros(cloud.shape[0]*cloud.shape[1]).float()
    dist_count = 0
    cloud_count = 0
    for i in range(cloud.shape[0]):
        for ii in range(cloud.shape[1]):
            curr_cloud = cloud[i,ii]
            centroid_losses[cloud_count] = centroid_loss(curr_cloud, centroids[i,ii])
            shape_losses[cloud_count] = shape_loss(curr_cloud, default_clouds[i,ii],vols[i,ii])
            cloud_count += 1
            #only look at distance to organs nearby or the top <5> nearest
            max_d = max(max_d_threshold, sorted(dists[i,ii])[5])
            for iii in range(cloud.shape[1]):
                if dists[i,ii,iii] > max_d or ii == iii:
                    continue
                dist_loss = min_distance_loss(curr_cloud,cloud[i,iii],dists[i,ii,iii])
                dist_losses[dist_count] = dist_loss
                dist_count += 1
    l = sw*(shape_losses.mean()) + cw*(centroid_losses.mean()) + dw*(dist_losses[0:dist_count].mean())
    return l