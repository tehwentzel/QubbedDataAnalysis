import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Spinner from 'react-bootstrap/Spinner';
import RuleViewD3 from './RuleViewD3.js';

export default function RuleView(props){
    const ref = useRef(null)

    const [vizComponents,setVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )


    function makeRow(rule,key){
        return (
        <Row md={12} key={key} className={'noGutter fillWidth'} style={{'height': '8em'}}>
            <RuleViewD3
                rule={rule}
                doseData={props.doseData}
                ruleData={props.ruleData}
                svgPaths={props.svgPaths}
                mainSymptom={props.mainSymptom}
                clusterData={props.clusterData}
                ruleThreshold={props.ruleThreshold}
                ruleCluster={props.ruleCluster}
            ></RuleViewD3>
        </Row>
        )
    }

    useEffect(function plotStuff(){
        if(props.ruleData !== undefined){

            let entries = props.ruleData.map((r,i) => makeRow(r,i+'rule'));
            setVizComponents(entries)
        }
    },[props.ruleData,props.doseData])

    return (
        <div ref={ref} className={'noGutter fillSpace scroll'}>
            {vizComponents}
        </div>
    )
}

