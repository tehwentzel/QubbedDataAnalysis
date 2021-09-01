import React, {useState, useEffect, useRef} from 'react';
import Utils from '../../modules/Utils.js';
import './ClusterView.css';
import ClusterViewD3 from './ClusterViewD3.js';
import * as d3 from 'd3';

// import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

export default function ClusterView(props){

    const [clusterData, setClusterData] = useState({});
    const [clusterVizComponents, setClusterVizComponents] = useState((<div></div>));
    const [height, setHeight] = useState(0);
    const ref = useRef(null)

    useEffect(()=> {
        setHeight(ref.current.clientHeight);
    })

    const fetchClusterData = async () => {
        const res = await props.api.getClusterData(props.selectedDemographics);
        console.log('clusterdata', res);
        setClusterData(res);
        props.setGeoidGroupMap(res.geoid_group_dict);
    }

    useEffect(() => {
        fetchClusterData();
    }, [props.selectedDemographics])

    useEffect(function drawClusters(){
        if(clusterData.data !== undefined){
            try{
                var colorScales = {};
                var extents = {};
                var nColors = 0;
                for(var demographic of props.selectedDemographics){
                    colorScales[demographic] = props.colorManager.colorScaleFromExtents(clusterData[demographic], demographic, nColors);
                    extents[demographic] = clusterData[demographic];
                    nColors += 1
                }
                colorScales['retweet_count'] = props.colorManager.colorScaleFromExtents({'min': 0, 'max': 15}, 'retweets');
                colorScales['cases_per_capita_discrete'] = props.colorManager.colorScaleFromExtents(clusterData.cases_per_capita_discrete, 'cases');
                extents['retweet_count'] = {'min': 0, 'max': 15};
                extents['cases_per_capita_discrete'] = clusterData.cases_per_capita_discrete;
                var totalTweets = Utils.sum(clusterData.data.map(x => x.total_tweets));
                var getBarHeight = tweetCount => (tweetCount/totalTweets)*(height*(1 - .025*clusterData.data.length));
                var newClusterComponents = clusterData.data.map( (d,i) => {
                    let blockHeight = getBarHeight(d.total_tweets);
                    return (
                        <Row className={'clusterContainer'} key={i} md={12}>
                            <ClusterViewD3
                                data={d}
                                colorScales={colorScales}
                                height={blockHeight}
                                appProps={props}
                                extents={extents}
                                selectedFrame={props.selectedFrame}
                            ></ClusterViewD3>
                        </Row>
                    )
                });
                setClusterVizComponents(newClusterComponents);
            }
            //it fails if the demographics change and it's currently brushing since it will try to draw again before the data loads because the group is reset
            catch {};
        }
    },[clusterData,props.selectedFrame,props.brushedCountyGroupNum])

    return ( <div ref={ref} id={'clusterVizWindow'}>{clusterVizComponents}</div> )
}

function getDemColorScale(extents, interpolator){
    var scale = d3.scaleLinear()
        .domain([extents.min, extents.max])
        .range([.1,1]);

    if(interpolator === null){
        interpolator = d3.interpolateGreys;
    }
    var getColor = function(d){
        return interpolator(scale(d))
    }
    return getColor
}