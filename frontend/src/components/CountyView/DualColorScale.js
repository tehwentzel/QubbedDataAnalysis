import * as d3 from 'd3';
import Utils from '../../modules/Utils';
import textures from 'textures';
import { quantile } from 'simple-statistics';

export default class DualColorScale {
//class that deals with the texture of the map
//somewhat weird because I'm importing from old code, and the way textures are done is strange.
    constructor(cData, primaryVar, secondaryVar, tertiaryVar, scaleFunc = null){
        this.active = true;
        this.activePrimary = primaryVar !== 'none' & primaryVar !== undefined;
        this.activeSecondary = secondaryVar !== 'none' & primaryVar !== undefined;
        this.activeTertiary = tertiaryVar !== 'none' & tertiaryVar !== undefined;

        this.primaryVar = primaryVar;//demographic
        this.secondaryVar = secondaryVar;//whatever turns into the lines on the map, currently the tweets
        this.tertiaryVar = tertiaryVar;//for if I want to add in glyphs

        this.scaleRanges = Utils.arrange(0, 1, 20);
        this.colorRanges = Utils.arrange(.1,1,20);

        this.primarySingleAccessor = d => d[this.primaryVar];
        this.secondarySingleAccessor = d=>d[this.secondaryVar];
        this.tertiarySingleAccessor = d=>d[this.tertiaryVar];

        //this will interpolate things between 0 and 1
        //usually color for a configurable map variable
        this.primaryColorScale = this.getQuantileScale(cData, this.primarySingleAccessor, 20);
        //this will be tweet count with frame for now
        this.secondaryColorScale = this.getPowerScale(cData, this.secondarySingleAccessor, .1);
        this.tertiaryColorScale = this.getQuantileScale(cData, this.tertiarySingleAccessor, 10);

        //this part basically determines the color choice of the map variables
        this.primaryInterpolator = this.makeInterpolator(50);
        this.patternScale = d => 2*(Math.abs(d-.5)**.1);//this calcuates the stroke width of the map and if I change it, it doesn't work good and I don't know why
        if(primaryVar.includes('net_dem')){//this is a different form so it's weird
            this.primaryInterpolator = d3.interpolateRdBu;
        } 
        if(primaryVar.includes('cases') || primaryVar.includes('Cases')){
            this.primaryInterpolator = d3.interpolateReds;
        }
        this.secondaryInterpolator = d3.interpolateGreys;
        this.tertiaryInterpolator = this.makeInterpolator(80);

    }


    makeInterpolator(hue,hue2){
        //I have no idea what this does anymore
        var interpolateHue;
        if(hue2 === undefined){
            interpolateHue = function(d){
                let s = .1 + .9*d;
                let l = .9 - .55*d;
                return d3.hsl(hue, s,l).toString()
            }.bind(hue)
        } else{
            interpolateHue = function(d){
                let diff = 2*Math.abs(d - .5);
                let s = .1 + .9*diff;
                let l = .9 - .55*diff;
                let h = (d >= .5)? hue: hue2;
                return d3.hsl(h,s,l).toString()
            }
        }
        return interpolateHue
    }

    getPowerScale(cData, accessor, exponent=1){
        var scale = d3.scalePow()
            .exponent(exponent)
            .domain([0,d3.max(cData, accessor)])
            .range([0,1]);

        return scale;
    }

    getSymlogScale(cData, accessor){
        var scale = d3.scaleSymlog()
            .domain(d3.extent(cData, accessor))
            .range([0,1]);

        return scale;
    }

    getQuantileScale(cData, accessor, nQuantiles){
        //will use a discrete scale
        var values = cData.map(accessor)
        var scaleRanges = (nQuantiles !== undefined)? Utils.arrange(0,1, nQuantiles): this.scaleRanges;
        var colorRanges = (nQuantiles !== undefined)? Utils.arrange(0,1, nQuantiles): this.colorRanges;
        var quantiles = quantile(values.filter(d => d !== 0), scaleRanges);
        //so I think this will give a qunatile transform?
        var scale = d3.scaleLinear()
            .domain(quantiles)
            .range(colorRanges);

        // var quantileTransform = d => scale(d);
        return scale//quantileTransform
    }

    toTexture(countyEntry, size=3){
        let pVal = this.primarySingleAccessor(countyEntry);
        let sVal = this.secondarySingleAccessor(countyEntry);

        pVal = this.primaryColorScale(pVal);
        sVal = this.secondaryColorScale(sVal);
        
        return this.valToTexture(pVal, sVal);
    }

    valToTexture(pVal, sVal, size = 3){
        
        let pColor = this.primaryInterpolator(pVal);
        // let sColor = this.secondaryInterpolator(sVal);
        let sColor = this.primaryInterpolator(.5*pVal + Math.random());
        // let pScale = this.patternScale(sVal);//thickness of the texture stroke
        let pScale = this.patternScale(pVal);

        var texture = textures
            .lines()
            .orientation('vertical')
            .size(size)
            .stroke(pColor)
            .strokeWidth(pScale)
            .background(sColor);

        return texture
    }


    // getGlyphColor(d){
    //     if(!this.activeSecondary || !this.active){
    //         return '';
    //     }
    //     var sVal = this.secondarySingleAccessor(d);
    //     sVal = this.secondaryScale(sVal)
    //     return this.secondaryInterpolator(sVal)
    // }

    // getGlyphRadius(d){
    //     if(!this.activeSecondary || !this.active){
    //         return 0
    //     }
    //     return(d.retweet_count_discreet);
    // }

    // scaleRadius(valueQuant, populationQuant){
    //     return 7*((populationQuant*valueQuant)**.5) + 1
    // }

    // drawGlyph(node){
    //     // console.log('drawGlyph', node);
    // }
}