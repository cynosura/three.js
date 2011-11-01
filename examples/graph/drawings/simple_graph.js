var Drawing = Drawing || {};

Drawing.SimpleGraph = function(options) {
  var options = options || {};
  
  this.layout          = options.layout           || "3d";
  this.layout_options  = options.graphLayout      || {};
  this.show_stats      = options.showStats        || false;
  this.show_labels     = options.showLabels       || false;
  this.selection       = options.selection        || false;
  this.limit           = options.limit            || 100000;
  this.nodes_count     = options.numNodes         || 20;
  this.edges_count     = options.numEdges         || 10;
  this.containerElement= options.containerElement || document.body;
  this.statsFunc       = options.statsFunc        || (function(x,y){})

  var camera, scene, renderer, interaction, geometry, 
      object_selection, controls, stats;

  var info_text        = {};
  var graph            = new Graph({limit: options.limit});
  
  var lineMaterial     = new THREE.LineBasicMaterial( { color: 0x333333, opacity: 0.4, linewidth: 0.05 } );
  var sprite           = THREE.ImageUtils.loadTexture( "textures/sprites/ball.png" );
  var material         = new THREE.ParticleBasicMaterial( { size: 85, map: sprite, vertexColors: true } );

  var particleGeometry = new THREE.Geometry();
  var lineGeometry     = new THREE.Geometry();
    
  var that=this;

  init();
  createGraph();
  animate();

  function init() {
    // renderer
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setSize( window.innerWidth, window.innerHeight );
    
    // camera
    camera = new THREE.PerspectiveCamera( 55, 
      window.innerWidth / window.innerHeight, 1, 50000 );

    // controls
    controls = new THREE.TrackballControls(camera);
    
    with(controls) {
      rotateSpeed = 0.5;
      zoomSpeed   = 5.2;
      panSpeed    = 1;

      noZoom      = false;
      noPan       = false;

      staticMoving = false;
      dynamicDampingFactor = 0.15;
      
      domElement = renderer.domElement;

      keys: [ 65, 83, 68 ]
    }
    
    camera.position.z = 10000;

    // scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2( 0xFFFFFF, 0.00004 );
    
    // mesh & particle system for nodes
    var particles = new THREE.ParticleSystem(particleGeometry, material);
    particles.sortParticles = true;
    scene.add( particles );

    // line geometry for edges
    var line = new THREE.Line(lineGeometry, lineMaterial, THREE.LinePieces );
    line.scale.x = line.scale.y = line.scale.z = 1;
    line.originalScale = 1;
    scene.add( line );

    // light for selection cubes
    //var sun = new THREE.DirectionalLight( 0xFFFFFF );
    //sun.position = camera.position.clone();
    //scene.add( sun );

    // create a single cube
    //createCube( 2000, new THREE.Vector3( 0,0,0 ) );
    
    // present the canvas
    that.containerElement.appendChild( renderer.domElement );
  
    // Stats.js
    if(that.show_stats) {
      stats = new Stats();
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.top = '0px';
      
      that.containerElement.appendChild( stats.domElement );
    }  
  }
  
  function createCube( s, p ) {
    cube = new THREE.Mesh (
      new THREE.CubeGeometry( s, s, s ),
      new THREE.MeshLambertMaterial({wireframe: true, color: Math.random() * 0x000000, opacity: 1.0})
    );

    cube.position = p;
    scene.add( cube );
  };

  function createGraph() {
    var nodeStack = [];
    var nodeid = 0;
    
    var node = new Node(nodeid++);
    node.data.title = "This is node " + node.id;
    
    graph.addNode(node);
    nodeStack.push(node);
    drawParticle(node);

    while(nodeid < that.nodes_count) {
      var node = nodeStack.shift(); // pops the stack
      var numEdges = randomFromTo(1, that.edges_count);

      for(var i=1; i <= numEdges && nodeid < that.nodes_count; i++) {
        var target_node = new Node(nodeid++);
        nodeStack.push(target_node);
        
        if(graph.addNode(target_node)) {
          target_node.data.title = "This is node " + target_node.id;
          
          drawParticle(target_node);

          if(graph.addEdge(node, target_node)) {
            drawEdge(node, target_node);
          }
        }
      }
    } 
    
    that.layout_options.width = that.layout_options.width || 2000;
    that.layout_options.height = that.layout_options.height || 2000;
    that.layout_options.iterations = that.layout_options.iterations || 1000;
    that.layout_options.layout = that.layout_options.layout || that.layout;
    
  	graph.layout = new Layout.ForceDirected(graph, that.layout_options);
    graph.layout.init();
  	
  	that.statsFunc(graph.nodes.length, graph.edges.length);
  }

  function drawParticle(node) {
    var area = 5000;

    var x = Math.floor(Math.random() * (area + area + 1) - area);
    var y = Math.floor(Math.random() * (area + area + 1) - area);
    var z = Math.floor(Math.random() * (area + area + 1) - area);

    var vec = new THREE.Vector3(x,y,z);
    var v = new THREE.Vertex(vec);
    
    particleGeometry.vertices.push(v);

    v.id = node.id;
    node.data.draw_object = v;
    node.position = v.position;
  }
  
  /**
   *  Create an edge object (line) and add it to the scene.
   */
  function drawEdge(source, target) {
      lineGeometry.vertices.push(new THREE.Vertex(source.data.draw_object.position));
      lineGeometry.vertices.push(new THREE.Vertex(target.data.draw_object.position));
  }

  function createCube( s, p ) {
    cube = new THREE.Mesh (
      new THREE.CubeGeometry( s, s, s ),
      [ new THREE.MeshBasicMaterial({ wireframe: true, color: Math.random() * 0x000000, opacity: 0.5}),
        new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, wireframe: true })]
    );

    cube.position = p;
    scene.add( cube );
  };

  function animate() {
    requestAnimationFrame( animate );
    render();
    if(that.show_info) {
      printInfo();
    }
  }

  function render() {
    // Generate layout if not finished
    if(!graph.layout.finished) {
      info_text.calc = "<span style='color: red'>Calculating layout...</span>";
      graph.layout.generate();

      particleGeometry.__dirtyVertices = true;
      lineGeometry.__dirtyVertices = true;
    } else {
      info_text.calc = "";
    }
  
    /*
    if(that.show_labels) {
      var length = graph.nodes.length;
      for(var i=0; i<length; i++) {
        var node = graph.nodes[i];
        if(node.data.label_object != undefined) {
          node.data.label_object.position.x = node.data.draw_object.position.x;
          node.data.label_object.position.y = node.data.draw_object.position.y - 100;
          node.data.label_object.position.z = node.data.draw_object.position.z;
          node.data.label_object.lookAt(camera.position);
        } else {
          if(node.data.title != undefined) {
            var label_object = new THREE.Label(node.data.title, node.data.draw_object);
          } else {
            var label_object = new THREE.Label(node.id, node.data.draw_object);
          }
          node.data.label_object = label_object;
          scene.add( node.data.label_object );
        }
      }
    } else {
      
      var length = graph.nodes.length;
      for(var i=0; i<length; i++) {
        var node = graph.nodes[i];
        if(node.data.label_object != undefined) {
          scene.remove( node.data.label_object );
          node.data.label_object = undefined;
        }
      
      }
    }*/

    // render selection
    /*if(that.selection) {
      object_selection.render(scene, camera);
    }*/

    // update stats
    if(that.show_stats) {
      stats.update();
    }
    
    // render scene
    controls.update();
    renderer.render( scene, camera );
  }

  /**
   *  Prints info from the attribute info_text.
   */
  function printInfo(text) {
    var str = '';
    for(var index in info_text) {
      if(str != '' && info_text[index] != '') {
        str += " - ";
      }
      str += info_text[index];
    }
    document.getElementById("graph-info").innerHTML = str;
  }

  // Generate random number
  function randomFromTo(from, to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
  }
  
  // Stop layout calculation
  this.stop_calculating = function() {
    graph.layout.stop_calculating();
  }
}