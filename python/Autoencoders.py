import torch.nn as nn
import torch.nn.functional as F
import torch
from Pytorchtools import EarlyStopping
import numpy as np
from Formatting import *
from Constants import Const
import matplotlib.pyplot as plt

class OrganAutoEncoder(nn.Module):
    
    def __init__(self,
                input_size,
                hidden_dims = [500,100,20,100,500],
                init_dropout = .7,
                embedding_dropout = .2,
                penult_dropout = .1
                ):
        
        super(OrganAutoEncoder,self).__init__()
            
        self.input_size = input_size
        self.init_dropout = init_dropout
        self.hidden_dims = hidden_dims
        self.embedding_dropout = embedding_dropout
        self.penult_dropout = penult_dropout
        
        self.hidden_layers = self.init_hidden_layers()
        self.leaky_relu = nn.LeakyReLU(.2)
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
        final_activation = nn.LeakyReLU(.2)
        layers.append(final)
#         layers.append(final_activation)
        return nn.Sequential(*layers)
        
    def forward(self,x):
        #we keep in nans in the data so I can ignore them in the loss function
        x = torch.nan_to_num(x)
        xout = self.flatten(x)
        xout = self.dropout_layer(xout)
        xout = self.hidden_layers(xout)
        return torch.nan_to_num(xout.reshape(x.shape))
    
class Normalizer():

    def __init__(self, x):
        self.std = 1
        self.mean = 0
        self.fit(x)

    def fit(self, x):
        self.std = np.std(np.nan_to_num(x), axis = 0)
        self.mean = np.mean(np.nan_to_num(x), axis = 0)

    def transform(self, x):
        x = (x - self.mean)/(self.std + .0001)
        return x

    def fit_transform(self, x):
        self.fit(x)
        return self.transform(x)

    def unnormalize(self, x):
        return x*self.std + self.mean
    
    
def nan_mse_loss(ypred, y):
    #ignores loss in the autoencoder for missing values
    y = torch.flatten(y)
    ypred = torch.flatten(ypred)
    mask = torch.isnan(y)
    out = (ypred[~mask] - y[~mask])**2
    loss = out.mean()
    return loss

def np_to_torch(x):
#     x = x.reshape((x.shape[0],-1))
    x = torch.tensor(x).float()
    return x
    
def train_autoencoder(autoencoder, x, model_path, 
                      lr=.001,
                      patience = 200,
                      plot_hist = False,
                      epochs = 10000,
                     ):
    optimizer = torch.optim.Adam(autoencoder.parameters(), lr = lr)
    #this is the one that saves the best model during training
    early_stopping = EarlyStopping(patience = patience, path=model_path)
    losses = []
    for epoch in range(epochs):
        optimizer.zero_grad()
        y_pred = autoencoder(x)
        
        loss = nan_mse_loss(y_pred, x)
        loss.backward()
        losses.append(loss.item())
        optimizer.step()
        torch.cuda.empty_cache()
        early_stopping(loss.item(), autoencoder)
        if early_stopping.early_stop:
            print('training stopped on epoch', epoch - patience)
            break
    autoencoder.load_state_dict(torch.load(model_path))
    if plot_hist:
        print('initial_loss', nan_mse_loss(torch.zeros(x.shape),x))
        print('best loss', early_stopping.best_score)
        plt.plot(early_stopping.get_loss_history())
    return autoencoder
    
def get_trained_autoencoder(x, 
                      train = True,
                      model_path = None, 
                      **kwargs): 
    #takes x np array in form n_items x (dims)
    #assumes missing values are nan and ignores them in training
    #saves model to model_path or default resources dir as autoencoder_<nitems>.pt
    autoencoder = OrganAutoEncoder(x.reshape((x.shape[0],-1)).shape[-1])
    
    if model_path is None:
        model_path = pytorch_model_name(x)
        print("autoencoder path not set with original info needed for recreation")
    if not train:
        try: 
            autoencoder.load_state_dict(torch.load(model_path))
        except:
            print("issue loading pretrained autoencoder",model_path,'training...')
            autoencoder = train_autoencoder(autoencoder, x, model_path, **kwargs)
    else:
        autoencoder = train_autoencoder(autoencoder, x, model_path, **kwargs)
        
    autoencoder = autoencoder.eval()
    return autoencoder

def pytorch_model_name(x, keys = None):
    name = Const.pytorch_model_dir + 'autoencoder' 
    if keys is not None:
        name += "_" + '_'.join(keys) 
    else:
        name += "_nokeys"
    name += '_' + 'x'.join([str(s) for s in x.shape])
    name += '.pt'
    return name

def autoencode(sdata, keys, **kwargs):
    #convert things into a normalized float that works with torch
    x_original, x_dims = multikey_merged_spatial_array(sdata,keys)
    normalizer = Normalizer(x_original)
    x = normalizer.transform(x_original)
    x = torch.tensor(x).float()
    
    #make model name encode original settings to prevent confusion
    model_path = pytorch_model_name(x, keys)
    autoencoder = get_trained_autoencoder(x, model_path = model_path, **kwargs)
    #check the final loss
    x_encoded = autoencoder(x)
    print(nan_mse_loss(x_encoded,x))
    
    x_out = x_encoded.cpu().detach().numpy()
    x_out = normalizer.unnormalize(x_out)
    out_arrays = {}
    curr_pos = 0
    for key, dim in x_dims:
        next_pos = curr_pos + dim
        x_key = x_out[:,:,curr_pos: next_pos]
        x0_key = x_original[:,:, curr_pos: next_pos]
        curr_pos = next_pos
        out_arrays[key] = {'denoised': x_key, 'original': x0_key}
    return out_arrays