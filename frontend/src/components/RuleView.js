import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Form from 'react-bootstrap/Form';
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
        let title = 'OR: ' + rule.odds_ratio.toFixed(2) 
            + ' |Info Gain: ' + rule.info.toFixed(3)   
            + ' |ROC:' + rule.roc_auc.toFixed(2)
            + ' |F1:' + rule.f1.toFixed(2) 
            + ' |Prsn:' + rule.precision.toFixed(2) 
            + ' |Rcl:' + rule.recall.toFixed(2);
        if (props.ruleTargetCluster >= 0){
            title += ' |Outcome ROC:' + rule.roc_auc_symptom.toFixed(2) 
            + ' |Outcome F1:' + rule.f1_symptom.toFixed(2);
        }

        return (
        <Row 
            key={key+props.mainSymptom+props.ruleCluster+props.ruleThreshold} 
            style={{'display':'inline-block','width':'50%','height': '20em','marginBottom':'1em'}}
        >
            <span  style={{'fontSize':'.7em'}}>
            {title}
            </span>
            <Row  
                className={'noGutter fillWidth'} 
                style={{'height': '18em'}}
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
                    selectedPatientId={props.selectedPatientId}
                    setSelectedPatientId={props.setSelectedPatientId}
                    ruleTargetCluster={props.ruleTargetCluster}
                ></RuleViewD3>
            </Row>
        </Row>
        )
    }

    function toggleFilter(arg){
        if(!arg){
            props.setRuleCluster(undefined);
        } else{
            props.setRuleCluster(parseInt(props.activeCluster));
        }
        props.setRuleTargetCluster(-1);
    }

    function makeFilterToggle(){
        function onSetTargetCluster(){
            if(props.ruleTargetCluster !== props.activeCluster){
                props.setRuleTargetCluster(props.activeCluster);
            }
        }
        const predictClusterActive = (props.ruleTargetCluster === props.activeCluster);
        return (
            <div className={'center-block'}>
            <Form.Label>{'Prediction'}</Form.Label>
            <InputGroup>
                <Button
                    variant={(!filterCluster & !predictClusterActive)? 'dark':'outline-secondary'}
                    onClick={() => toggleFilter(false)}
                    disabled={!filterCluster & !predictClusterActive}
                >{'cohort->outcome'}</Button>
                <Button
                    variant={(filterCluster & !predictClusterActive)? 'dark':'outline-secondary'}
                    onClick={()=>toggleFilter(true)}
                    disabled={filterCluster & !predictClusterActive}
                >{'clust ' + props.activeCluster + '->outcome'}</Button>
                <Button
                    variant={predictClusterActive? 'dark':'outline-secondary'}
                    onClick={onSetTargetCluster}
                    disabled={predictClusterActive}
                >{'cohort->clust ' + props.activeCluster}</Button>
            </InputGroup>
            </div>
        )
    }

    function makeCriteriaToggle(){
        var makeButton = (name)=>{
            let active = (props.ruleCriteria === name);
            return (
                <Button
                    variant={active? 'dark':'outline-secondary'}
                    onClick={()=>{props.setRuleCriteria(name)}}
                    disabled={active}
                >{name}</Button>
            )
        }
        return (
            <div className={'center-block'}>
            <Form.Label>{'Criteria'}</Form.Label>
            <InputGroup
            >
                {makeButton('info')}
                {makeButton('odds_ratio')}
            </InputGroup>
            </div>
        )
    }

    function makeOrganSetToggle(){
        var makeButton = (boolState)=>{
            let active = (props.ruleUseAllOrgans === boolState);
            let name = 'All';
            if(!boolState){
                name = 'Cluster'
            }
            return (
                <Button
                    variant={active? 'dark':'outline-secondary'}
                    onClick={()=>{props.setRuleUseAllOrgans(boolState)}}
                    disabled={active}
                >{name}</Button>
            )
        }
        return (
            <div className={'center-block'}>
            <Form.Label>{'Organs'}</Form.Label>
            <InputGroup
            >
                {makeButton(true)}
                {makeButton(false)}
            </InputGroup>
            </div>
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

    function makeMaxSplitsDropDown(){
        var handleChangeSplit = (s)=>{
            if(props.ruleMaxDepth !== s){
                props.setRuleMaxDepth(s);
            }
        }
        const dItems = [1,2,3,4,5].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    onClick={e => handleChangeSplit(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                className={'controlDropdownButton'}
                title={'Max Splits ' + props.ruleMaxDepth}
            >{dItems}</DropdownButton>
        )
    }

    function makeMaxRulesDropDown(){
        var handleChangeMaxRules = (s)=>{
            if(props.maxRules !== s){
                props.setMaxRules(s);
            }
        }
        const dItems = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((t,i) => {
            return (
                <Dropdown.Item
                    key={i}
                    value={t}
                    eventKey={t}
                    
                    onClick={e => handleChangeMaxRules(t)}
                >{t}</Dropdown.Item>
            )
        });
        return (
            <DropdownButton
                drop={'up'}
                className={'controlDropdownButton'}
                title={'Max Rules ' + props.maxRules}
            >{dItems}</DropdownButton>
        )
    }

    function makeThresholdForm(){
        let onKey = (e) => {
            if(e.code === 'Enter'){
                let val = e.target.value;
                if(Number.isInteger(val) & parseInt(val) !== props.ruleThreshold){
                    props.setRuleThreshold(parseInt(val))
                }
            }
        }
        return (
            <>
                <Form.Label>{'Symptom Threshold'}</Form.Label>
                <InputGroup>
                    <Button
                        onClick={()=>{props.setRuleThreshold(props.ruleThreshold-1)}}
                    >{'-'}</Button>
                    <FormControl
                        defaultValue={props.ruleThreshold}
                        onKeyDown={onKey}
                    />
                    <Button
                        onClick={()=>{props.setRuleThreshold(props.ruleThreshold+1)}}
                    >{'+'}</Button>
                </InputGroup>
            </>
        )
    }

    useEffect(function plotStuff(){
        if(props.ruleData !== undefined & props.doseData !== undefined){

            let entries = props.ruleData.map((r,i) => makeRow(r,i+'rule'));
            setVizComponents(entries)
        } else{
            setVizComponents(
                <Spinner 
                as="span" 
                animation = "border"
                role='status'
                className={'spinner'}/>
            )
        }
    },[props.ruleData,props.doseData,props.selectedPatientId])

    return (
        <div ref={ref} className={'noGutter fillSpace'}>
            <Row md={12} className={'noGutter fillSpace'}>
                <Col md={10} className={'noGutter scroll'} style={{'height':'45vh'}}>
                    {vizComponents}
                </Col>
                <Col md={2} className={'noGutter'}>
                    {makeFilterToggle()}
                    {makeCriteriaToggle()}
                    {makeOrganSetToggle()}
                    {makeThresholdDropDown()}
                    {makeMaxSplitsDropDown()}
                    {makeMaxRulesDropDown()}
                    {/* {makeThresholdForm()} */}
                </Col>
            </Row>
        </div>
    )
}

