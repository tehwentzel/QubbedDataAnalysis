import React, {useState, useEffect, useRef, Fragment} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import Spinner from 'react-bootstrap/Spinner';



export default function GamView(props){
    const ref = useRef(null)

    const [organVizComponents,setOrganVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    const [gamVizComponents,setGamVizComponents] = useState(
        <Spinner 
            as="span" 
            animation = "border"
            role='status'
            className={'spinner'}/>
    )

    return (
        <div ref={ref}>
            <Container className={'noGutter fillSpace'}>
                <Row md={6} className={'noGutter fillHeight'}>
                    {organVizComponents}
                </Row>
                <Row md={6} className={'noGutter fillHeight'}>
                    {gamVizComponents}
                </Row>
            </Container>
        </div>
    )
}

