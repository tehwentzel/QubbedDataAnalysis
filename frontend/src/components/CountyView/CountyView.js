import React, {Fragment, useState, useEffect} from 'react';
import './CountyView.css';
import DualColorScale from './DualColorScale.js';

import CountyViewD3 from './CountyViewD3.js';
import CountyViewLegendD3 from './CountyViewLegendD3.js';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';

export default function CountyView(props){

    const [countyData, setCountyData] = useState({});
    const [countyVizComponents, setCountyVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    );
    const [loaded, setLoaded] = useState(false);

    const fetchCountyData = async () => {
        const res = await props.api.getCountyData(props.selectedDemographics);
        setCountyData(res);
        setLoaded(true);
    }

    useEffect(() => {
        fetchCountyData();
    },[]);

    useEffect(() => {
        let geoid = props.brushedCountyGeoid;
        if(geoid === undefined || countyData.demographics === undefined || geoid < 0){ return; }
        let brushedCounty = countyData.demographics
            .filter(d => parseInt(d.GEOID) == parseInt(geoid));
        props.setBrushedCountyData(brushedCounty[0]);
    },[props.brushedCountyGeoid,countyData])


    useEffect(function drawCountys(){
        if(!loaded){return}
        if(countyData.borders !== undefined){
            const colorMaker = new DualColorScale(countyData.demographics, props.mapVar, props.selectedFrame,'none');
            var newCountyVizComponent = (
                <Fragment>
                    <Col className={'noGutter fillSpace'} md={10}>
                        <CountyViewD3
                            data={countyData}
                            mapVar={props.mapVar}
                            colorMaker={colorMaker}
                            appProps={props}
                        >
                        </CountyViewD3>
                    </Col>
                    <Col className={'noGutter fillSpace'}  md={2}>
                        <CountyViewLegendD3
                            colorMaker={colorMaker}
                            data={countyData}
                            mapVar={props.mapVar}
                            mapVar={props.mapVar}
                        ></CountyViewLegendD3>
                    </Col>
                </Fragment>
            )
            setCountyVizComponents(newCountyVizComponent);
        } else{
            console.log("error loading countymap?", Object.keys(countyData));
        }
    },[countyData, loaded, props.brushedCountyGeoid, props.mapVar, props.selectedFrame])

    return (
        <Fragment>
            {countyVizComponents}
        </Fragment>
        )
}