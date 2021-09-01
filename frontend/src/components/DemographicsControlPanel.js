import React, {useState, useEffect} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from '../modules/Constants.js';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function DemographicsControlPanel(props){

    const [gamDropDowns, setGamDropDowns] = useState(['','','','']);
    const modelInputs = constants.MODEL_FEATURES;
    const modelTypes = constants.MODEL_TYPES;
    const [modelOutputs, setModelOutputs] = useState([...constants.MODEL_OUTPUTS])
    const [avaliableDemographics, setAvaliableDemographics] = useState([...modelInputs]);

    function handleSelectGamVar(event, varName, varPos){
        if(props.selectedDemographics === undefined){ return }
        var newDemList = [...props.selectedDemographics];
        //if the variable is a new one, add it to the array
        if(props.selectedDemographics.length < varPos){
            newDemList.push(varName);
            props.setSelectedDemographics(newDemList);
        } 
        else{
            //if they selected None, just remove from the list
            if(varName === 'None'){
                newDemList.splice(varPos,1);
            }
            else{
                //else, replace it
                var oldDemographic = props.selectedDemographics[varPos];
                if(oldDemographic !== varName){
                    newDemList[varPos] = varName;
                }
            }
            props.setSelectedDemographics(newDemList);
        }
        
    }

    function handleSelectGamType(tName){
        if(tName !== props.gamType){
            props.setGamType(tName);
        }
    }

    function handleSelectGamOutput(oName){
        let trueOutput = props.gamPredictor;
        if(oName == props.selectedFrame){ oName = ''; }
        if(oName !== trueOutput){
            props.setGamPredictor(oName);
        }
    }

    useEffect(function updateOutputDropdownOptions(){
        let output = [props.selectedFrame];
        for(let i of constants.MODEL_OUTPUTS){
            output.push(i);
        }
        setModelOutputs(output);
    },[props.selectedFrame])

    useEffect(function updateGamDropdownOptions(){
        if(props.selectedDemographics === undefined){ return }
        var avaliable = ['None'];
        for(let i = 0; i < modelInputs.length; i++){
            let demog = modelInputs[i];
            if (!props.selectedDemographics.includes(demog)){
                avaliable.push(demog);
            }
        }
        setAvaliableDemographics(avaliable);
    },[props.selectedDemographics])


    useEffect(function setGamDropDown(){
        if(avaliableDemographics === undefined){ return; }
        var varList = [...props.selectedDemographics];
        varList.push('None');
        var dropDowns = varList.map((string,idx) =>{
            var optionsList = [...avaliableDemographics];
            var options = optionsList.map((d,ii) => {
                return (
                    <Dropdown.Item 
                        key={ii} 
                        value={d} 
                        eventKey={d} 
                        onClick={(e) => handleSelectGamVar(e,d,idx)}
                    >
                        {Utils.getVarDisplayName(d)}
                    </Dropdown.Item> 
                )
            });
            let buttonText = 'Add Feature';
            if(props.selectedDemographics.length >= idx){
                let bt = Utils.getVarDisplayName(props.selectedDemographics[idx]);
                if(bt !== undefined){ buttonText = bt; }
            }

            let variant = (string == 'None')? 'outline-primary':'primary';

            return (
                <Row key={idx} md={12} className={'controlPanelCol noGutter'}>
                    <DropdownButton 
                        className={'controlDropdownButton'} 
                        title={buttonText}
                        variant={variant}
                    >
                        {options}
                    </DropdownButton>
                </Row>
            )
        })
        setGamDropDowns(dropDowns)
    },[avaliableDemographics]);

    const modelTypeOptions = modelTypes.map((d,ii) =>{
        return (
            <Dropdown.Item
                key={ii}
                value={d}
                eventKey={d}
                onClick={(e)=>handleSelectGamType(d)}
            >{Utils.getVarDisplayName(d)}</Dropdown.Item>
        )
    });

    const modelOutputDisplay = props.gamPredictor === ''? props.selectedFrame: props.gamPredictor;
    const modelOutputOptions = modelOutputs.map((d,ii) => {
        return (
            <Dropdown.Item
                key={ii}
                value={d}
                eventKey={d}
                onClick={(e)=>handleSelectGamOutput(d)}
            >{Utils.getVarDisplayName(d)}</Dropdown.Item>
        )
    });

    return (
        <Container className={'controlPanel noGutter'} md={12}>
            <Row md={12} className={'noGutter'}><p className={'chartTitle noGutter'}>Model Output:</p></Row>
            <Row md={12} className={'controlPanelCol noGutter'}>
                <DropdownButton
                    className={'controlDropdownButton'}
                    title={Utils.getVarDisplayName(modelOutputDisplay)}
                    variant={'primary'}
                >
                    {modelOutputOptions}
                </DropdownButton>
            </Row>
            <Row md={12} className={'noGutter'}><p className={'chartTitle noGutter'}>Model Type:</p></Row>
            <Row md={12} className={'controlPanelCol noGutter'}>
                <DropdownButton
                    className={'controlDropdownButton'}
                    title={Utils.getVarDisplayName(props.gamType)}
                    variant={'primary'}
                >
                    {modelTypeOptions}
                </DropdownButton>
            </Row>
            <Row md={12} className={'noGutter'}><p className={'chartTitle noGutter'}>Model Features:</p></Row>
            {gamDropDowns}

        </Container>
    )
}
