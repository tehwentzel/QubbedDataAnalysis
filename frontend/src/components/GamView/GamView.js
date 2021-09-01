import React, {useState, useEffect, useRef} from 'react';
import Utils from '../../modules/Utils.js';
import './GamView.css';
import GamViewD3 from './GamViewD3.js';
import * as d3 from 'd3';

// import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

export default function GamView(props){

    const [gamData, setGamData] = useState([]);
    const [gamVizComponents, setGamVizComponents] = useState((<div></div>));
    const [height, setHeight] = useState(0);
    const ref = useRef(null)

    useEffect(()=> {
        setHeight(ref.current.clientHeight);
    })

    const fetchClusterData = async () => {
        let selectedPredictor = getTruePredictor(props);
        const res = await props.api.getGamData(props.selectedDemographics,selectedPredictor,props.gamType);
        setGamData(res);
    }

    useEffect(() => {
        fetchClusterData();
    }, [props.selectedDemographics,props.selectedFrame,props.gamType,props.gamPredictor])

    useEffect(function drawCharts(){
        if(gamData !== undefined || gamData.length < 1){
            let sd = props.selectedDemographics;

            var getYBounds = function(d){
                let yLower = d['pdep_quantile_0.05'];
                let yUpper = d['pdep_quantile_0.95'];
                return d3.max(yUpper) - d3.min(yLower);
            }

            var yBound = gamData.map(d => getYBounds(d));
            var globalY = Utils.sum(yBound);

            gamData.sort((a,b) => (sd.indexOf(a.feature) - sd.indexOf(b.feature)));//sorts in place.  I dont think this should make issues elsewhere but idk
            var newGamComponents = gamData.map( (d,i) => {
                let blockHeight = .85*(height*getYBounds(d)/globalY);
                const minBlockHeight = .25*(.85*height);
                if(blockHeight < minBlockHeight){
                    blockHeight = minBlockHeight;
                }

                //will be undefined if not there, I think
                // const bcd = props.brushedCountyData;
                let selectedPredictor = getTruePredictor(props);
                return (
                <Container key={i}>
                    <Row className={'chartTitle gamChartTitle'}  md={12}>
                        <p>
                            {Utils.getVarDisplayName(d.feature) 
                                + ' vs ' + Utils.getVarDisplayName(getTruePredictor(props))
                                + ' (p<' + Math.max(Math.round(d.pval*100)/100, 0.001) + ')'
                            }
                        </p>
                    </Row>
                    <Row className={'gamChartContainer noGutter'} md={12}>
                        <GamViewD3
                            data={d}
                            height={blockHeight}
                            // brushedXValue={brushedXValue}
                            // brushedYValue={brushedYValue}
                            brushedCounty={props.brushedCountyData}
                            brushedCountyGeoid={props.brushedCountyGeoid}
                            selectedInput={d.feature}
                            selectedPredictor={selectedPredictor}
                            appProps={props}
                        ></GamViewD3>
                    </Row>
                </Container>
                )
            });
            setGamVizComponents(newGamComponents);
        }
    },[gamData,props.brushedCountyData,props.brushedCountyGeoid])

    return ( <div ref={ref} id={'gamVizWindow'}>{gamVizComponents}</div> )

}

function getTruePredictor(props){
    let selectedPredictor = props.gamPredictor;
    if(selectedPredictor === '' || selectedPredictor === undefined){
        selectedPredictor = props.selectedFrame;
    }
    return selectedPredictor;
}