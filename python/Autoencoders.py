import torch.nn as nn
import torch.nn.functional as F
import torch
from Pytorchtools import EarlyStopping
import numpy as np
from Formatting import *
from Constants import Const

class BasicDenoiser(nn.Module):
    
    def __init__(self,
                input_size,
                hidden_dims = [800,800],
                init_dropout = .5,
                embedding_dropout = 0.0,
                penult_dropout = 0.0,
                numpy_input = True,
                ):
        
        super().__init__()
            
        self.input_size = input_size
        self.init_dropout = init_dropout
        self.hidden_dims = hidden_dims
        self.embedding_dropout = embedding_dropout
        self.penult_dropout = penult_dropout
        
        self.hidden_layers = self.init_hidden_layers()
        self.dropout_layer = nn.Dropout(p=self.init_dropout)
        self.flatten = nn.Flatten().cuda()
        self.numpy_input = numpy_input
        
    def init_hidden_layers(self):
        first = nn.Linear(self.input_size, self.hidden_dims[0])
        layers = [first,nn.ReLU()]
        embedding_size = min(*self.hidden_dims)
        for i in range(len(self.hidden_dims)-1):
            hidden = nn.Linear(self.hidden_dims[i], self.hidden_dims[i+1])
            layers.append(hidden)
            if self.hidden_dims[i+1] <= embedding_size:
                layers.append(nn.Dropout(p=self.embedding_dropout))
                layers.append(nn.BatchNorm1d(self.hidden_dims[i+1]))
            layers.append(nn.ReLU())
        penultimate_dropout = nn.Dropout(p=self.penult_dropout)
        final = nn.Linear(self.hidden_dims[-1], self.input_size)
        final_activation = nn.ReLU()#nn.LeakyReLU(.1)#nn.ReLU()#nn.Tanh()
        layers.append(final)
        layers.append(final_activation)
        return nn.Sequential(*layers)

    def set_bounds(self,xin,xout):
        l = torch.min(xin,axis=0)[0]
        u = torch.max(xin,axis=0)[0]
        x = torch.max(torch.min(xout,u),l)
        return x
        
    def forward(self,x):
        #we keep in nans in the data so I can ignore them in the loss function
        if self.numpy_input:
            x = torch.tensor(x).float()
        x = torch.nan_to_num(x)
#         xout = self.flatten(xout)
        xout = self.dropout_layer(x)
        xout = self.hidden_layers(xout)
#         xout = torch.nan_to_num(xout.reshape(x.shape))
        xout = self.set_bounds(x,xout)
        return xout

class OrganAutoEncoder(nn.Module):
    
    def __init__(self,
                input_size,
                hidden_dims = [200,100,20,100,200],
                init_dropout = .5,
                embedding_dropout = .2,
                penult_dropout = .2
                ):
        
        super().__init__()
            
        self.input_size = input_size
        self.init_dropout = init_dropout
        self.hidden_dims = hidden_dims
        self.embedding_dropout = embedding_dropout
        self.penult_dropout = penult_dropout
        
        self.hidden_layers = self.init_hidden_layers()
        self.dropout_layer = nn.Dropout(p=self.init_dropout)
        self.flatten = nn.Flatten().cuda()
        
    def init_hidden_layers(self):
        first = nn.Linear(self.input_size, self.hidden_dims[0])
        layers = [first,nn.ReLU()]
        embedding_size = min(*self.hidden_dims)
        for i in range(len(self.hidden_dims)-1):
            hidden = nn.Linear(self.hidden_dims[i], self.hidden_dims[i+1])
            layers.append(hidden)
            if self.hidden_dims[i+1] <= embedding_size:
                layers.append(nn.Dropout(p=self.embedding_dropout))
                layers.append(nn.BatchNorm1d(self.hidden_dims[i+1]))
            layers.append(nn.ReLU())
        penultimate_dropout = nn.Dropout(p=self.penult_dropout)
        final = nn.Linear(self.hidden_dims[-1], self.input_size)
        final_activation = nn.LeakyReLU(.1)#nn.ReLU()#nn.Tanh()
        layers.append(final)
        layers.append(final_activation)
        return nn.Sequential(*layers)

    def set_bounds(self,xin,xout):
        l = torch.min(xin,axis=0)[0]
        u = torch.max(xin,axis=0)[0]
        x = torch.max(torch.min(xout,u),l)
        return x
        
    def forward(self,x):
        #we keep in nans in the data so I can ignore them in the loss function
        x = torch.nan_to_num(x)
        xout = self.flatten(x)
        xout = self.dropout_layer(xout)
        xout = self.hidden_layers(xout)
        xout = torch.nan_to_num(xout.reshape(x.shape))
        xout = self.set_bounds(x,xout)
        return xout
    
class ConditionalOrganAutoEncoder(OrganAutoEncoder):
    #this is for megering cohorts
    #currently no function difference, besides default size
    def __init__(self,
                input_size,
                hidden_dims = [1500,500,100,500,1500],
                init_dropout = .6,
                embedding_dropout = .1,
                penult_dropout = .1,
                ):
        super().__init__(input_size,
                         hidden_dims=hidden_dims,
                         init_dropout=init_dropout,
                         embedding_dropout=embedding_dropout,
                        penult_dropout=penult_dropout)
    
class Normalizer():

    def __init__(self, x):
        self.std = 1
        self.mean = 0
        self.c = .0001
        #set the max absolue values so it works with Tanh regression in bounds
        self.fit(x)

    def fit(self, x):
        self.std = np.std(np.nan_to_num(x), axis = 0)
        self.mean = np.mean(np.nan_to_num(x), axis = 0)
            
    def transform(self, x):
        x = (x - self.mean)/(self.std + self.c)
        return x

    def fit_transform(self, x):
        self.fit(x)
        return self.transform(x)

    def unnormalize(self, x):
        x = (x*(self.std + self.c)) + self.mean
        return x
    