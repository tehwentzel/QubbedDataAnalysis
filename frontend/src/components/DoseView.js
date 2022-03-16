import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Dose2dCenterViewD3 from './Dose2dCenterViewD3.js';
import ClusterSymptomsD3 from './ClusterSymptomsD3.js';

import Spinner from 'react-bootstrap/Spinner';


export default function DoseView(props){
    const ref = useRef(null)

   
    const [svgPaths,setSvgPaths] = useState();

    const [clusterVizComponents,setClusterVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    useEffect(()=>{
        fetch('organ_svgs/organ_svg_paths.json').then((newPaths)=>{
            newPaths.json().then((data)=>{
                console.log('paths',data)
                setSvgPaths(data);
            })
        })
    },[])

    useEffect(function drawClusters(){
        // console.log('organs',props.clusterOrgans)
        if(props.clusterData != undefined & svgPaths != undefined){
            //the plot var in a key makes it redraw the whole thing or the plot transforms is messed up
            //if I fix that later I should remove that in the key
            let newComponents = props.clusterData.map((d,i) => 
            {
                return (
                    <Container fluid={'true'} className={'noGutter  inline'} flex={'true'} key={i}>
                    <Container className={'Dose2dContainer inline'} md={5} key={i+'doses'+props.plotVar}>
                        <Dose2dCenterViewD3
                            data={d}
                            clusterOrgans={props.clusterOrgans}
                            plotVar={props.plotVar}
                            svgPaths={svgPaths}
                            orient={'both'}
                            addOrganToCue={props.addOrganToCue}
                            clusterOrganCue={props.clusterOrganCue}
                        ></Dose2dCenterViewD3>
                    </Container >
                    <Container className={'symptomPlotContainer inline'} md={5} key={i+'symptoms'}>
                        <ClusterSymptomsD3
                            data={d}
                        ></ClusterSymptomsD3>
                    </Container>
                    </Container>
                )
            })
            setClusterVizComponents(newComponents)
        } else{
            let newComponents = []
            for(let i = 0; i < props.nDoseClusters; i++){
                newComponents.push(
                    <Container  fluid={'true'} md={5} className={'noGutter inline'} flex={'true'} key={i}>
                    <Container className={'Dose2dContainer inline'} md={5} key={i+'doses'+props.plotVar}>
                        <Spinner 
                            as="span" 
                            animation = "border"
                            role='status'
                            className={'spinner'}
                        />
                    </Container>
                    <Container className={'symptomPlotContainer inline'} md={7} key={i+'symptoms'}>
                        <Spinner 
                            as="span" 
                            animation = "border"
                            role='status'
                            className={'spinner'}
                        />
                    </Container>
                    </Container >
                )
            }
            setClusterVizComponents(newComponents)
        }
    },[props.clusterData,svgPaths,props.clusterOrganCue,props.plotVar])

    return ( 
        <div ref={ref} id={'doseClusterContainer'}>
            {clusterVizComponents}
        </div> 
        )
}