import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
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

    const filterCluster = parseInt(props.ruleCluster) === parseInt(props.activeCluster)


    function makeRow(rule,key){
        return (
        <Row 
            key={key+props.mainSymptom+props.ruleCluster+props.ruleThreshold} 
            style={{'display':'inline-block','width':'50%','height': '8em'}}
        >
            <span className={'noGutter controlPanelTitle'}>
            {'odds ratio:' + rule.odds_ratio.toFixed(2)}
            </span>
            <Row  
                className={'noGutter fillWidth'} 
                style={{'height': '7em'}}
                mt={3}
            >
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
        </Row>
        )
    }

    function toggleFilter(){
        if(filterCluster){
            props.setRuleCluster(undefined);
        } else{
            props.setRuleCluster(parseInt(props.activeCluster));
        }
    }

    function makeFilterToggle(){
        return (
            <Row md={12} className={'noGutter'}>
                <Button
                    variant={filterCluster? 'outline-secondary':'dark'}
                    onClick={toggleFilter}
                    disabled={!filterCluster}
                >{'all clusters'}</Button>
                <Button
                    variant={!filterCluster? 'outline-secondary':'dark'}
                    onClick={toggleFilter}
                    disabled={filterCluster}
                >{'cluster ' + props.activeCluster}</Button>
            </Row>
        )
    }

    function handleChangeThreshold(t){
        t=parseInt(t);
        if(t !== props.ruleThreshold){
            props.setRuleThreshold(t);
        }
    }

    function makeThresholdDropDown(){
        const dItems = [3,4,5,6,7,8].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    onClick={e => handleChangeThreshold(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                className={'controlDropdownButton'}
                title={'Threshold ' + props.ruleThreshold}
            >{dItems}</DropdownButton>
        )
    }

    useEffect(function plotStuff(){
        if(props.ruleData !== undefined){

            let entries = props.ruleData.map((r,i) => makeRow(r,i+'rule'));
            setVizComponents(entries)
        }
    },[props.ruleData,props.doseData])

    return (
        <div ref={ref} className={'noGutter fillSpace'}>
            <Row md={12} className={'noGutter fillSpace'}>
                <Col md={8} className={'noGutter scroll'} style={{'height':'45vh'}}>
                    {vizComponents}
                </Col>
                <Col md={3} className={'noGutter'}>
                    {makeFilterToggle()}
                    {makeThresholdDropDown()}
                </Col>
            </Row>
        </div>
    )
}

