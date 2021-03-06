
/**
 * 注释:
 * 1,OrbitControls.js 		轨道控制器来控制场景的旋转、平移，缩放
 * 2,LineControls.js  		鼠标点击事件的操作控制器
 * 3,DragControls.js  		拖拽控件
 * 4,StateMachine.js		有限状态机，一个简单的实用程序，可让您定义状态和操作以在它们之间进行转换。
 * 5,viewDxf.js				Three-Dxf是一个浏览器dxf文件查看器应用，其使用dxf-parser解析dxf文件（解析出json格式），并使用three.js来渲染。
 * 6,Three.js
 */

import * as THREE from 'three'
import OrbitControls from './OrbitControls.js'
import LineControls from './LineControls.js'



// Three.js extension functions. Webpack doesn't seem to like it if we modify the THREE object directly.
var THREEx = { Math: {} };
/**
 * Returns the angle in radians of the vector (p1,p2). In other words, imagine
 * putting the base of the vector at coordinates (0,0) and finding the angle
 * from vector (1,0) to (p1,p2).
 * @param  {Object} p1 start point of the vector
 * @param  {Object} p2 end point of the vector
 * @return {Number} the angle
 */
THREEx.Math.angle2 = function(p1, p2) {
	var v1 = new THREE.Vector2(p1.x, p1.y);
	var v2 = new THREE.Vector2(p2.x, p2.y);
	v2.sub(v1); // sets v2 to be our chord
	v2.normalize();
	if(v2.y < 0) return -Math.acos(v2.x);
	return Math.acos(v2.x);
};


THREEx.Math.polar = function(point, distance, angle) {
	var result = {};
	result.x = point.x + distance * Math.cos(angle);
	result.y = point.y + distance * Math.sin(angle);
	return result;
};

/**
 * Calculates points for a curve between two points
 * @param startPoint - the starting point of the curve
 * @param endPoint - the ending point of the curve
 * @param bulge - a value indicating how much to curve
 * @param segments - number of segments between the two given points
 */
THREEx.BulgeGeometry = function ( startPoint, endPoint, bulge, segments ) {

	var vertex, i,
		center, p0, p1, angle,
		radius, startAngle,
		thetaAngle;

	THREE.Geometry.call( this );

	this.startPoint = p0 = startPoint ? new THREE.Vector2(startPoint.x, startPoint.y) : new THREE.Vector2(0,0);
	this.endPoint = p1 = endPoint ? new THREE.Vector2(endPoint.x, endPoint.y) : new THREE.Vector2(1,0);
	this.bulge = bulge = bulge || 1;

	angle = 4 * Math.atan(bulge);
	radius = p0.distanceTo(p1) / 2 / Math.sin(angle/2);
	center = THREEx.Math.polar(startPoint, radius, THREEx.Math.angle2(p0,p1) + (Math.PI / 2 - angle/2));

	this.segments = segments = segments || Math.max( Math.abs(Math.ceil(angle/(Math.PI/18))), 6); // By default want a segment roughly every 10 degrees
	startAngle = THREEx.Math.angle2(center, p0);
	thetaAngle = angle / segments;


	this.vertices.push(new THREE.Vector3(p0.x, p0.y, 0));

	for(i = 1; i <= segments - 1; i++) {

		vertex = THREEx.Math.polar(center, Math.abs(radius), startAngle + thetaAngle * i);

		this.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));

	}

};

THREEx.BulgeGeometry.prototype = Object.create( THREE.Geometry.prototype );
    
/**
 * Viewer class for a dxf object.
 * @param {Object} data - the dxf object
 * @param {Object} parent - the parent element to which we attach the rendering canvas
 * @param {Number} width - width of the rendering canvas in pixels
 * @param {Number} height - height of the rendering canvas in pixels
 * @param {Object} font - a font loaded with THREE.FontLoader 
 * @constructor
 */

// 记录角色所对应的颜色值
let roleColorData = [ '#00ff00', '#A327FF', '#00BFFF', '#FF9200', '#4BE402', '#FC0261' ]
let dxfLineTextColor = [ '#000000' ]

function Viewer(data, parent, width, height, font, dxfCallback) {
	
	// 全局this
	let _this = this
	// step
	let ZONE_ENTITIES = 50
	// setTimeout
	let timeOutValue = 100
	// 记录宽高
	let recordWidth = width
	let recordHeight = height
	
    createLineTypeShaders(data);

    var scene = new THREE.Scene();

    // Create scene from dxf object (data)
    var i, entity, obj, min_x, min_y, min_z, max_x, max_y, max_z;
    var dims = {
        min: { x: false, y: false, z: false},
        max: { x: false, y: false, z: false}
    };
    
    var camera = initCamera(width,height);
    var renderer = this.renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    renderer.setClearColor(0xfffffff, 1);

    renderer.domElement.id = 'dxfCanvasId';

    parent.appendChild(renderer.domElement);
    parent.style.display = 'block';

    //TODO: Need to make this an option somehow so others can roll their own controls.
    var controls = new OrbitControls(camera, parent,scene,dxfCallback);
    controls.target.x = camera.position.x;
    controls.target.y = camera.position.y;
    controls.target.z = 0;
    controls.zoomSpeed = 3;


    var LineControl = new LineControls(camera,parent,scene,width,height,controls,dxfCallback);
    LineControl.LineRender(renderer);
    // LineControls记录最大与最小的坐标
    LineControl.changeLineControls(dims, width, height)

    //window.addEventListener("resize",this.resize);
    //Uncomment this to disable rotation (does not make much sense with 2D drawings).
    //controls.enableRotate = false;

    this.render = function() { renderer.render(scene, camera) };
    controls.addEventListener('change', this.render);
    
    // OrbitControls记录最大与最小的坐标
    controls.changeOrbitControls(dims, width, height)
    
    controls.update('dxfDrawLoadingFinished');
    
    this.render();
    
    setTimeout(() => {
    	// 场景添加对象
    	mergeDxfBlockLine(data)
    }, timeOutValue)
    
    // 合并block里面的所有线
    function mergeDxfBlockLine (data) {
    	for (let key in data.blocks) {
    		if (data.blocks.hasOwnProperty(key) === true) {
    			if (data.blocks[key].entities && data.blocks[key].entities.length > 0) {
    				let entitiesLineFirst = ''
    				let indexArr = []
    				data.blocks[key].entities.forEach((item,index) => {
    					if (entitiesLineFirst && item.type === 'LINE') {
    						entitiesLineFirst.vertices = entitiesLineFirst.vertices.concat(item.vertices)
    						indexArr.unshift(index)
    					}
    					if (!entitiesLineFirst && item.type === 'LINE') {
    						entitiesLineFirst = item
    					}
    				})
    				indexArr.forEach((item,index) => {
    					data.blocks[key].entities.splice(item)
    				})
    			}
    		}
    	}
    	
    	sceneAddObject(data, 0)
    }
    
    // 场景添加对象
    function sceneAddObject (data, sign) {
    	let maxI = (sign + ZONE_ENTITIES) > data.entities.length ? data.entities.length : (sign + ZONE_ENTITIES)
    	for(let i = sign; i < maxI; i++) {
	        entity = data.entities[i];
	
	        if(entity.type === 'DIMENSION') {
	            if(entity.block) {
	                var block = data.blocks[entity.block];
	                if(!block) {
	                    console.error('Missing referenced block "' + entity.block + '"');
	                    continue;
	                }
	                for(var j = 0; j < block.entities.length; j++) {
	                    obj = drawEntity(block.entities[j], data);
	                }
	            } else {
	                console.log('WARNING: No block for DIMENSION entity');
	            }
	        } else {
	            obj = drawEntity(entity, data);
	        }
	
	        if (obj) {
	            var bbox = new THREE.Box3().setFromObject(obj);
	            if (bbox.min.x && ((dims.min.x === false) || (dims.min.x > bbox.min.x))) dims.min.x = bbox.min.x;
	            if (bbox.min.y && ((dims.min.y === false) || (dims.min.y > bbox.min.y))) dims.min.y = bbox.min.y;
	            if (bbox.min.z && ((dims.min.z === false) || (dims.min.z > bbox.min.z))) dims.min.z = bbox.min.z;
	            if (bbox.max.x && ((dims.max.x === false) || (dims.max.x < bbox.max.x))) dims.max.x = bbox.max.x;
	            if (bbox.max.y && ((dims.max.y === false) || (dims.max.y < bbox.max.y))) dims.max.y = bbox.max.y;
	            if (bbox.max.z && ((dims.max.z === false) || (dims.max.z < bbox.max.z))) dims.max.z = bbox.max.z;
	           
	            // 添加模型中的uuid，以便于后期操作中的模型与图纸的联动
	            if (entity.extendedData && entity.extendedData.customStrings && entity.extendedData.customStrings[0]) {
	            	obj.userData.modelUUID = entity.extendedData.customStrings[0]
	            }
				scene.add(obj);
	        }
	        obj = null;
	    }
    	
    	_this.onWindowResize(recordWidth, recordHeight)
    	
    	if (maxI < data.entities.length) {
    		setTimeout(() => {
    			sceneAddObject(data, maxI)
    		}, 1)
    	} else {
	    	// 场景添加完毕
	    	dxfCallback({
	    		type: 'sceneAddFinishDxf',
	    		data: new Date().getTime()
	    	})
    	}
    	
    }
    
    // 根据批注id单条删除dxf批注
    this.deleteDxfAnnotationCtrl = function (id) {
    	if (scene.getObjectByName(id)) {
            scene.remove(scene.getObjectByName(id));
        }
    	if (scene.getObjectByName('type' + id)) {
            scene.remove(scene.getObjectByName('type' + id));
        }
    	if (scene.getObjectByName('content' + id)) {
            scene.remove(scene.getObjectByName('content' + id));
        }
        renderer.render(scene, camera);
    }
    
    // 添加dxf批注
    this.dxfAnnotationListDrawCtrl = function (list) {
    	list.forEach((item,index) => {
    		if (!(scene.getObjectByName(item.annotationId))) {
    			LineControl.drawRectInitData(item)
    			scene.add(drawAnnotationTextType(item))
    			scene.add(drawAnnotationText(item))
			}
    	})
    	this.render()
    }
    
    // 绘制问题类型
    function drawAnnotationTextType(entity) {
        var geometry, material, text;
        let str = entity.type === 2 ? '严重问题' : '一般问题'
        if(!font)
            return console.warn('Text is not supported without a Three.js font loaded with THREE.FontLoader! Load a font of your choice and pass this into the constructor. See the sample for this repository or Three.js examples at http://threejs.org/examples/?q=text#webgl_geometry_text for more details.');
        geometry = new THREE.TextGeometry(str, { font: font, height: 1, size: 1});
        material = new THREE.MeshBasicMaterial({ color: roleColorData[entity.toRole] });
        text = new THREE.Mesh(geometry, material);
        text.position.x = entity.coordinate.drawRectWorldCoord.startX;
        text.position.y = entity.coordinate.drawRectWorldCoord.startY - 1.1;
        text.position.z = entity.z || 0;
        text.name = 'type' + entity.annotationId
        return text;
    }
    
    // 绘制问题内容
    function drawAnnotationText(entity) {
        var geometry, material, text;
        if(!font)
            return console.warn('Text is not supported without a Three.js font loaded with THREE.FontLoader! Load a font of your choice and pass this into the constructor. See the sample for this repository or Three.js examples at http://threejs.org/examples/?q=text#webgl_geometry_text for more details.');
        geometry = new THREE.TextGeometry(entity.content, { font: font, height: 1, size: 1});
        material = new THREE.MeshBasicMaterial({ color: roleColorData[entity.toRole] });
        text = new THREE.Mesh(geometry, material);
        text.position.x = entity.coordinate.drawRectWorldCoord.startX;
        text.position.y = entity.coordinate.drawRectWorldCoord.startY - 2.3;
        text.position.z = entity.z || 0;
        text.name = 'content' + entity.annotationId
        return text;
    }
    
    // 闪烁选中的矩形框
    this.selectedDxfAnnotationCtrl = function (data) {
    	for (let i = 0; i < 4; i++) {
    		setTimeout(() => {
    			if (parseInt(i%2) > 0) {
    				scene.getObjectByName(data.annotationId).material.color.set( roleColorData[data.toRole] )
    				this.render()
    			} else {
    				scene.getObjectByName(data.annotationId).material.color.set( roleColorData[0] )
    				this.render()
    			}
    		}, i * 200)
    	}
    }
    
    // 外部调用接口-返回当前世界坐标所对应的屏幕坐标
    this.pointToScreenPosition = function (item, callback) {
    	// 将自己添加的矩形框的世界坐标转换为当前所对应的屏幕坐标
		let start = {
			x: item.coordinate.drawRectWorldCoord.startX,
			y: item.coordinate.drawRectWorldCoord.startY,
			z: 0
		}
		let end = {
			x: item.coordinate.drawRectWorldCoord.endX,
			y: item.coordinate.drawRectWorldCoord.endY,
			z: 0
		}
		let screenValue = {
			minCoordinate: dims.min,
			maxCoordinate: dims.max,
			canvasWidth: recordWidth,
			canvasHeight: recordHeight
		}
		item.coordinate.drawRectScreenCoord.startX = controls.pointToScreenPosition(start, screenValue).x
		item.coordinate.drawRectScreenCoord.startY = controls.pointToScreenPosition(start, screenValue).y
		item.coordinate.drawRectScreenCoord.endX = controls.pointToScreenPosition(end, screenValue).x
		item.coordinate.drawRectScreenCoord.endY = controls.pointToScreenPosition(end, screenValue).y
    	callback(item)
    }
    
    // 外部调用接口-返回绘制面积，距离，角度，周长
    this.commonDxfDrawEvent = function (type, callback) {
    	LineControl.commonDxfDrawEvent(type, callback)
    }
	
	
	
	
	
	// 根据图纸对应的屏幕坐标的最小点与最大点修改相机位置
	this.changeProjectionMatrix = function (val){
		
		let dw = 1080 * recordWidth / recordHeight
		let dh = 1080
		
		let x1 = mapNumRange(0, val.minPositionx, val.maxPositionx, dims.min.x, dims.max.x)
		let x2 = mapNumRange(dw, val.minPositionx, val.maxPositionx, dims.min.x, dims.max.x)
		let dx = (x2 - x1) / 2
		let y1 = mapNumRange(0, val.minPositiony, val.maxPositiony, dims.min.y, dims.max.y)
		let y2 = mapNumRange(dh, val.minPositiony, val.maxPositiony, dims.min.y, dims.max.y)
		let dy = (y2 - y1) / 2
		
		if ((dx / dy) < dw / dh) {
			dx = dw * (dy / dh)
		} else{
			dy = dh * (dx / dw)
		}
		
		let sx = (val.minPositionx + val.maxPositionx) / 2
		let sy = (val.minPositiony + val.maxPositiony) / 2
		
		let a = 1.0
		camera.left = -dx * a
		camera.right = dx * a
		camera.top = dy * a
		camera.bottom = -dy * a
		
		let screenValue = {
			minCoordinate: dims.min,
			maxCoordinate: dims.max,
			canvasWidth: dw,
			canvasHeight: dh
		}
		let dMin = controls.pointToScreenPosition(dims.min, screenValue)
		let dMax = controls.pointToScreenPosition(dims.max, screenValue)
		let mx = (dMin.x + dMax.x) / 2
		let my = (dMin.y + dMax.y) / 2
		controls.pan(((sx - mx) * recordWidth / dw) + (val.offsetX * (1 - recordWidth / dw)), (sy - my) * recordHeight / dh)
		controls.update('modelToDxf')
	}
	function mapNumRange(num, inMin, inMax, outMin, outMax){
		return (((num - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin)
	}
	
	
	
	
	
	// 重置相机位置
	this.onWindowResize = function (changeWidth, changeHeight) {
		recordWidth = changeWidth
		recordHeight = changeHeight
		
		camera = null
		camera = initCamera(recordWidth,recordHeight)
		camera.updateProjectionMatrix()
		renderer.setSize( recordWidth, recordHeight );
		
		controls.changeOrbitControls(dims, recordWidth, recordHeight, camera, parent, scene)
	    controls.target.x = camera.position.x;
	    controls.target.y = camera.position.y;
	    controls.update('dxfDrawLoadingFinished');
		
	    LineControl.changeLineControls(dims, recordWidth, recordHeight, camera, parent, scene)
	    LineControl.LineRender(this.renderer);
		
		this.render()
	}
	
	// 清空场景
	this.sceneRemoveViewer = function () {
		for (let i = scene.children.length - 1; i >= 0; i--) {
			var myMesh = scene.children[i]
		    if(myMesh.type === 'Mesh'){
				scene.remove(myMesh)
				myMesh.geometry.dispose()
				myMesh.material.dispose()
				myMesh = null
		    } else {
		    	scene.remove(myMesh)
		    	myMesh = null
		    }
		}
		this.render()
		scene = null
	}
	
	// 切换图纸
	this.sceneAddViewer = function (dxfData, changeWidth, changeHeight) {
		
		recordWidth = changeWidth
		recordHeight = changeHeight
		
		// 重置最大最小点
		dims = {
	        min: { x: false, y: false, z: false},
	        max: { x: false, y: false, z: false}
	    }
		
		scene = new THREE.Scene()
		
		controls.update('dxfDrawLoadingFinished')
		this.render()
		
		setTimeout(() => {
	    	// 场景添加对象
	    	mergeDxfBlockLine(dxfData)
	    }, timeOutValue)
	}
	
    function initCamera(width,height) {
        width = width || parent.innerWidth;
        height = height || parent.innerHeight;
        var aspectRatio = width / height;

        var upperRightCorner = { x: dims.max.x || ZONE_ENTITIES, y: dims.max.y || ZONE_ENTITIES };
        var lowerLeftCorner = { x: dims.min.x || ZONE_ENTITIES, y: dims.min.y || ZONE_ENTITIES };

        // Figure out the current viewport extents
        var vp_width = upperRightCorner.x - lowerLeftCorner.x;
        var vp_height = upperRightCorner.y - lowerLeftCorner.y;
        var center = center || {
            x: vp_width / 2 + lowerLeftCorner.x,
            y: vp_height / 2 + lowerLeftCorner.y
        };

        // Fit all objects into current ThreeDXF viewer
        var extentsAspectRatio = Math.abs(vp_width / vp_height);
        if (aspectRatio > extentsAspectRatio) {
            vp_width = vp_height * aspectRatio;
        } else {
            vp_height = vp_width / aspectRatio;
        }

        var viewPort = {
            bottom: -vp_height / 2,
            left: -vp_width / 2,
            top: vp_height / 2,
            right: vp_width / 2,
            center: {
                x: center.x,
                y: center.y
            }
        };
        
        // var camera = new THREE.PerspectiveCamera(45, width / height, 0.001, 10000);
        // camera.lookAt(new THREE.Vector3(viewPort.center.x, viewPort.center.y, 0));
        
        var camera = new THREE.OrthographicCamera(viewPort.left, viewPort.right, viewPort.top, viewPort.bottom, 0.001, 10000);
        camera.position.z = ZONE_ENTITIES;
        camera.position.x = viewPort.center.x;
        camera.position.y = viewPort.center.y;
        return camera;
    }
    function drawEntity(entity, data) {
    	var mesh;
        if(entity.type === 'CIRCLE' || entity.type === 'ARC') {
            mesh = drawArc(entity, data);
        } else if(entity.type === 'LWPOLYLINE' || entity.type === 'LINE' || entity.type === 'POLYLINE') {
        	// 黑色(line的改了一半，带有pattern的是轴网-红线，不带的还是用的原来的材质)
            mesh = drawLine(entity, data);
        } else if(entity.type === 'TEXT') {
        	// 黑色
            mesh = drawText(entity, data);
        } else if(entity.type === 'SOLID') {
        	// 黑色
            mesh = drawSolid(entity, data);
        } else if(entity.type === 'POINT') {
        	// 黑色
            mesh = drawPoint(entity, data);
        } else if(entity.type === 'INSERT') {
            mesh = drawBlock(entity, data);
        } else if(entity.type === 'SPLINE') {
        	// 黑色
            mesh = drawSpline(entity, data);
        } else if(entity.type === 'MTEXT') {
        	// 黑色
            mesh = drawMtext(entity, data);
        } else if(entity.type === 'ELLIPSE') {
        	// 黑色
            mesh = drawEllipse(entity, data);
        } else {
            console.log("Unsupported Entity Type: " + entity.type);
        }
        return mesh;
    }

    function drawEllipse(entity, data) {
        var color = getColor(entity, data);

        var xrad = Math.sqrt(Math.pow(entity.majorAxisEndPoint.x,2) + Math.pow(entity.majorAxisEndPoint.y,2));
        var yrad = xrad*entity.axisRatio;
        var rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x);

        var curve = new THREE.EllipseCurve(
            entity.center.x,  entity.center.y,
            xrad, yrad,
            entity.startAngle, entity.endAngle,
            false, // Always counterclockwise
            rotation
        );

        var points = curve.getPoints( 50 );
        var geometry = new THREE.BufferGeometry().setFromPoints( points );
        
        var material = new THREE.LineBasicMaterial( {  linewidth: 1, color : dxfLineTextColor[0] || color } );

        // Create the final object to add to the scene
        var ellipse = new THREE.Line( geometry, material );
        return ellipse;
    }

    function drawMtext(entity, data) {
        var color = getColor(entity, data);

        var geometry = new THREE.TextGeometry( entity.text, {
            font: font,
            size: entity.height * (4/5),
            height: 1
        });
        
        var material = new THREE.MeshBasicMaterial( {color: dxfLineTextColor[0] || color} );
        
        var text = new THREE.Mesh( geometry, material );

        // Measure what we rendered.
        var measure = new THREE.Box3();
        measure.setFromObject( text );

        var textWidth  = measure.max.x - measure.min.x;

        // If the text ends up being wider than the box, it's supposed
        // to be multiline. Doing that in threeJS is overkill.
        if (textWidth > entity.width) {
            console.log("Can't render this multipline MTEXT entity, sorry.", entity);
            return undefined;
        }

        text.position.z = 0;
        switch (entity.attachmentPoint) {
            case 1:
                // Top Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y - entity.height;
            break;
            case 2:
                // Top Center
                text.position.x = entity.position.x - textWidth/2;
                text.position.y = entity.position.y - entity.height;
            break;
            case 3:
                // Top Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y - entity.height;
            break;

            case 4:
                // Middle Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y - entity.height/2;
            break;
            case 5:
                // Middle Center
                text.position.x = entity.position.x - textWidth/2;
                text.position.y = entity.position.y - entity.height/2;
            break;
            case 6:
                // Middle Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y - entity.height/2;
            break;

            case 7:
                // Bottom Left
                text.position.x = entity.position.x;
                text.position.y = entity.position.y;
            break;
            case 8:
                // Bottom Center
                text.position.x = entity.position.x - textWidth/2;
                text.position.y = entity.position.y;
            break;
            case 9:
                // Bottom Right
                text.position.x = entity.position.x - textWidth;
                text.position.y = entity.position.y;
            break;

            default:
                return undefined;
        };

        return text;
    }

    function drawSpline(entity, data) {
        var color = getColor(entity, data);

        var points = entity.controlPoints.map(function(vec) {
            return new THREE.Vector2(vec.x, vec.y);
        });

        var interpolatedPoints = [];
        
        
        var curve = {};
        
        
        if (entity.degreeOfSplineCurve === 2 || entity.degreeOfSplineCurve === 3) {
            for(var i = 0; i + 2 < points.length; i = i + 2) {
        if (entity.degreeOfSplineCurve === 2) {
                        curve = new THREE.QuadraticBezierCurve(points[i], points[i + 1], points[i + 2]);
        } else {
            curve = new THREE.QuadraticBezierCurve3(points[i], points[i + 1], points[i + 2]);
        }
                interpolatedPoints.push.apply(interpolatedPoints, curve.getPoints(50));
            }
        } else {
            curve = new THREE.SplineCurve(points);
            interpolatedPoints = curve.getPoints( 100 );
        }

        var geometry = new THREE.BufferGeometry().setFromPoints( interpolatedPoints );
        
        var material = new THREE.LineBasicMaterial( { linewidth: 1, color : dxfLineTextColor[0] || color } );
        
        var splineObject = new THREE.Line( geometry, material );

        return splineObject;
    }

    function drawLine(entity, data) {
        var geometry = new THREE.Geometry(),
            color = getColor(entity, data),
            material, lineType, vertex, startPoint, endPoint, bulgeGeometry,
            bulge, i, line;

        // create geometry
        for(i = 0; i < entity.vertices.length; i++) {

            if(entity.vertices[i].bulge) {
                bulge = entity.vertices[i].bulge;
                startPoint = entity.vertices[i];
                endPoint = i + 1 < entity.vertices.length ? entity.vertices[i + 1] : geometry.vertices[0];

                bulgeGeometry = new THREEx.BulgeGeometry(startPoint, endPoint, bulge);

                geometry.vertices.push.apply(geometry.vertices, bulgeGeometry.vertices);
            } else {
                vertex = entity.vertices[i];
                geometry.vertices.push(new THREE.Vector3(vertex.x, vertex.y, 0));
            }

        }
        if(entity.shape) geometry.vertices.push(geometry.vertices[0]);


        // set material
        if(entity.lineType) {
            lineType = data.tables.lineType.lineTypes[entity.lineType];
        }
		
        if(lineType && lineType.pattern && lineType.pattern.length !== 0) {
            material = new THREE.LineDashedMaterial({ color: color, gapSize: 4, dashSize: 4});
        } else {
            material = new THREE.LineBasicMaterial({ linewidth: 1, color: dxfLineTextColor[0] || color });
        }

        // if(lineType && lineType.pattern && lineType.pattern.length !== 0) {

        //           geometry.computeLineDistances();

        //           // Ugly hack to add diffuse to this. Maybe copy the uniforms object so we
        //           // don't add diffuse to a material.
        //           lineType.material.uniforms.diffuse = { type: 'c', value: new THREE.Color(color) };

        // 	material = new THREE.ShaderMaterial({
        // 		uniforms: lineType.material.uniforms,
        // 		vertexShader: lineType.material.vertexShader,
        // 		fragmentShader: lineType.material.fragmentShader
        // 	});
        // }else {
        // 	material = new THREE.LineBasicMaterial({ linewidth: 1, color: color });
        // }
		
		// 所有点连起来绘制
        // line = new THREE.Line(geometry, material);
        // 所有点分线段绘制
        line = new THREE.LineSegments(geometry, material);
        return line;
    }
    
    function drawArc(entity, data) {
        var startAngle, endAngle;
        if (entity.type === 'CIRCLE') {
            startAngle = entity.startAngle || 0;
            endAngle = startAngle + 2 * Math.PI;
        } else {
            startAngle = entity.startAngle;
            endAngle = entity.endAngle;
        }

        var curve = new THREE.ArcCurve(
            0, 0,
            entity.radius,
            startAngle,
            endAngle);

        var points = curve.getPoints( 32 );
        var geometry = new THREE.BufferGeometry().setFromPoints( points );

        var material = new THREE.LineBasicMaterial({ color: getColor(entity, data) });

        var arc = new THREE.Line(geometry, material);
        arc.position.x = entity.center.x;
        arc.position.y = entity.center.y;
        arc.position.z = entity.center.z;

        return arc;
    }

    function drawSolid(entity, data) {
        var material, mesh, verts,
            geometry = new THREE.Geometry();

        verts = geometry.vertices;
        verts.push(new THREE.Vector3(entity.points[0].x, entity.points[0].y, entity.points[0].z));
        verts.push(new THREE.Vector3(entity.points[1].x, entity.points[1].y, entity.points[1].z));
        verts.push(new THREE.Vector3(entity.points[2].x, entity.points[2].y, entity.points[2].z));
        verts.push(new THREE.Vector3(entity.points[3].x, entity.points[3].y, entity.points[3].z));

        // Calculate which direction the points are facing (clockwise or counter-clockwise)
        var vector1 = new THREE.Vector3();
        var vector2 = new THREE.Vector3();
        vector1.subVectors(verts[1], verts[0]);
        vector2.subVectors(verts[2], verts[0]);
        vector1.cross(vector2);

        // If z < 0 then we must draw these in reverse order
        if(vector1.z < 0) {
            geometry.faces.push(new THREE.Face3(2, 1, 0));
            geometry.faces.push(new THREE.Face3(2, 3, 1));
        } else {
            geometry.faces.push(new THREE.Face3(0, 1, 2));
            geometry.faces.push(new THREE.Face3(1, 3, 2));
        }

        material = new THREE.MeshBasicMaterial({ color: dxfLineTextColor[0] || getColor(entity, data) });

        return new THREE.Mesh(geometry, material);
        
    }

    function drawText(entity, data) {
        var geometry, material, text;

        if(!font)
            return console.warn('Text is not supported without a Three.js font loaded with THREE.FontLoader! Load a font of your choice and pass this into the constructor. See the sample for this repository or Three.js examples at http://threejs.org/examples/?q=text#webgl_geometry_text for more details.');
        
        geometry = new THREE.TextGeometry(entity.text, { font: font, height: 0, size: entity.textHeight || 12 });

        material = new THREE.MeshBasicMaterial({ color: dxfLineTextColor[0] || getColor(entity, data) });

        text = new THREE.Mesh(geometry, material);
        text.position.x = entity.startPoint.x;
        text.position.y = entity.startPoint.y;
        text.position.z = entity.startPoint.z;

        return text;
    }

    function drawPoint(entity, data) {
        var geometry, material, point;

        geometry = new THREE.Geometry();

        geometry.vertices.push(new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z));

        // TODO: could be more efficient. PointCloud per layer?

        var numPoints = 1;

        var color = getColor(entity, data);
        var colors = new Float32Array( numPoints*3 );
        colors[0] = color.r;
        colors[1] = color.g;
        colors[2] = color.b;

        geometry.colors = colors;
        geometry.computeBoundingBox();

        material = new THREE.PointsMaterial( { size: 0.05, vertexColors: dxfLineTextColor[0] || THREE.VertexColors } );
        
        point = new THREE.Points(geometry, material);
        scene.add(point);
    }

    function drawBlock(entity, data) {
        var block = data.blocks[entity.name];
        
        if (!block.entities) return null;

        var group = new THREE.Object3D()
        
        if(entity.xScale) group.scale.x = entity.xScale;
        if(entity.yScale) group.scale.y = entity.yScale;

        if(entity.rotation) {
            group.rotation.z = entity.rotation * Math.PI / 180;
        }

        if(entity.position) {
            group.position.x = entity.position.x;
            group.position.y = entity.position.y;
            group.position.z = entity.position.z;
        }
        
        for(var i = 0; i < block.entities.length; i++) {
            var childEntity = drawEntity(block.entities[i], data, group);
            if(childEntity) group.add(childEntity);
        }

        return group;
    }

    function getColor(entity, data) {
        var color = 0x000000; //default
        if(entity.color) color = entity.color;
        else if(data.tables && data.tables.layer && data.tables.layer.layers[entity.layer])
            color = data.tables.layer.layers[entity.layer].color;
            
        if(color == null || color === 0xffffff) {
            color = 0x000000;
        }
        return color;
    }

    function createLineTypeShaders(data) {
        var ltype, type;
        if(!data.tables || !data.tables.lineType) return;
        var ltypes = data.tables.lineType.lineTypes;

        for(type in ltypes) {
            ltype = ltypes[type];
            if(!ltype.pattern) continue;
            ltype.material = createDashedLineShader(ltype.pattern);
        }
    }

    function createDashedLineShader(pattern) {
        var i,
            dashedLineShader = {},
            totalLength = 0.0;

        for(i = 0; i < pattern.length; i++) {
            totalLength += Math.abs(pattern[i]);
        }

        dashedLineShader.uniforms = THREE.UniformsUtils.merge([

            THREE.UniformsLib[ 'common' ],
            THREE.UniformsLib[ 'fog' ],

            {
                'pattern': { type: 'fv1', value: pattern },
                'patternLength': { type: 'f', value: totalLength }
            }

        ]);

        dashedLineShader.vertexShader = [
            'attribute float lineDistance;',

            'varying float vLineDistance;',

            THREE.ShaderChunk[ 'color_pars_vertex' ],

            'void main() {',

            THREE.ShaderChunk[ 'color_vertex' ],

            'vLineDistance = lineDistance;',

            'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

            '}'
        ].join('\n');

        dashedLineShader.fragmentShader = [
            'uniform vec3 diffuse;',
            'uniform float opacity;',

            'uniform float pattern[' + pattern.length + '];',
            'uniform float patternLength;',

            'varying float vLineDistance;',

            THREE.ShaderChunk[ 'color_pars_fragment' ],
            THREE.ShaderChunk[ 'fog_pars_fragment' ],

            'void main() {',

            'float pos = mod(vLineDistance, patternLength);',

            'for ( int i = 0; i < ' + pattern.length + '; i++ ) {',
            'pos = pos - abs(pattern[i]);',
            'if( pos < 0.0 ) {',
            'if( pattern[i] > 0.0 ) {',
            'gl_FragColor = vec4(1.0, 0.0, 0.0, opacity );',
            'break;',
            '}',
            'discard;',
            '}',

            '}',

            THREE.ShaderChunk[ 'color_fragment' ],
            THREE.ShaderChunk[ 'fog_fragment' ],

            '}'
        ].join('\n');

        return dashedLineShader;
    }

    function findExtents(scene) { 
        for(var child of scene.children) {
            var minX, maxX, minY, maxY;
            if(child.position) {
                minX = Math.min(child.position.x, minX);
                minY = Math.min(child.position.y, minY);
                maxX = Math.max(child.position.x, maxX);
                maxY = Math.max(child.position.y, maxY);
            }
        }

        return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY }};
    }

}


// Show/Hide helpers from https://plainjs.com/javascript/effects/hide-or-show-an-element-42/
// get the default display style of an element
function defaultDisplay(tag) {
    var iframe = document.createElement('iframe');
    iframe.setAttribute('frameborder', 0);
    iframe.setAttribute('width', 0);
    iframe.setAttribute('height', 0);
    document.documentElement.appendChild(iframe);

    var doc = (iframe.contentWindow || iframe.contentDocument).document;

    // IE support
    doc.write();
    doc.close();

    var testEl = doc.createElement(tag);
    doc.documentElement.appendChild(testEl);
    var display = (window.getComputedStyle ? getComputedStyle(testEl, null) : testEl.currentStyle).display
    iframe.parentNode.removeChild(iframe);
    return display;
}

// actual show/hide function used by show() and hide() below
function showHide(el, show) {
    var value = el.getAttribute('data-olddisplay'),
    display = el.style.display,
    computedDisplay = (window.getComputedStyle ? getComputedStyle(el, null) : el.currentStyle).display;

    if (show) {
        if (!value && display === 'none') el.style.display = '';
        if (el.style.display === '' && (computedDisplay === 'none')) value = value || defaultDisplay(el.nodeName);
    } else {
        if (display && display !== 'none' || !(computedDisplay == 'none'))
            el.setAttribute('data-olddisplay', (computedDisplay == 'none') ? display : computedDisplay);
    }
    if (!show || el.style.display === 'none' || el.style.display === '')
        el.style.display = show ? value || '' : 'none';
}

// helper functions
function show(el) { showHide(el, true); }
function hide(el) { showHide(el); }

/*
export {
    Viewer,
    defaultDisplay,
    showHide,
    show,
    hide
}
*/

export default Viewer;



