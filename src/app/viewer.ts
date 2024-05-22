import { mat4, vec3, vec4 } from 'gl-matrix';
import { MeshData } from './mockup_meshdata';
import { Material } from './material';
import { Light } from './light';

// This class define a viewer to display a 3D mesh stored into a MeshData object.
// The display is mapped into a canvas passed into the constructor.
// The create from a raw MeshData object call init(). To refresh call reset().
// display() implement the opgl draw.
// 

export class Viewer {
    object : Material; // mesh material properties
    lights : Light; // light components
    alpha : number; // transparency 1=opaque, 0=transparent
    displayFaces : boolean; // toggle to display lines or triangles
    projectionMatrix :mat4;
    modelViewMatrix :mat4; 
    tz : number; // how far from object is the viewer
    rotations: any; // rotations of the object

    gl : WebGLRenderingContext;
    indices!: number[]; // array of vertices index
    lineIndices!: number[]; // array of line indices for wireframe
    buffers!: any; // buffer object to store indices and lineIndices

    shaderProgram : any;  // WebGLProgram   
    canvas: HTMLCanvasElement;
    // Get attribute and uniform locations
    locations : any; // locations for variables in shaders they are attrib and unform locations
    valid: boolean;
    constructor(canvas:HTMLCanvasElement)
    {
        this.valid = false;
        this.canvas=canvas;
        this.projectionMatrix = mat4.create();
        this.modelViewMatrix = mat4.create();          
        this.tz =  -3.;
        this.rotations = {
            x: 65.0,
            y: 15.0,
            z: 65.0
        };

        this.object = new Material();
        this.lights= new Light();
        this.alpha= 0;
        this.displayFaces = true;        
        this.locations=     
        {
            attrib: {
                aPosition: null, //this.gl.getAttribLocation(shaderProgram, "aVertexPosition"),
                aNormal: null, //this.gl.getAttribLocation(shaderProgram, "aVertexNormal"),
            },
            uniform: {
                uProjectionMatrix: null, //this.gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
                uModelViewMatrix: null, //this.gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),

                uMatDiffuseColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uMatDiffuseColor");
                uMatAmbientColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uMatAmbientColor");
                uMatSpecularColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uMatSpecularColor");
                uMatShininess : null, // this.gl.getUniformLocation(this.shaderProgram, "uMatShininess");
                uMatTransparency : null,
                // Light
                uPointLight : null, // this.gl.getUniformLocation(this.shaderProgram, "uPointLight");
                uLigthDiffuseColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uLigthDiffuseColor");
                uLigthAmbientColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uLigthAmbientColor");
                uLigthSpecularColor : null, // this.gl.getUniformLocation(this.shaderProgram, "uLigthSpecularColor");
            },
        };    
        this.shaderProgram= null;
        
        // Get the WebGL context

        this.gl = canvas.getContext('webgl') as WebGLRenderingContext;  


        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }   

        this.buffers = {
            indexBuffer: this.gl.createBuffer(),
            lineIndexBuffer: this.gl.createBuffer()
        }
    }
    // toggle rendering from faces to lines 
    // to apply display shall be called after
    displayToggle(toggle:boolean)
    {
        this.displayFaces= toggle;
    }
    // transform an array of array into a "flat" array
    // [[abcd],[efgh]] => [abcdefgh]
    flatten_array(array_of_array :number[][]) :number[]
    {
        const flat_array=[];
        for (let i = 0; i < array_of_array.length; i++) {
            for (let j = 0; j < array_of_array[i].length; j++) {
                flat_array.push(array_of_array[i][j]);
            }
        }    
        return flat_array;
    }

    // Create a transformation matrix to normalize the mesh
    createNormalizationMatrix(scaleFactor:number, centerX:number, centerY:number, centerZ:number) {
        return [
            scaleFactor, 0, 0, -scaleFactor * centerX,
            0, scaleFactor, 0, -scaleFactor * centerY,
            0, 0, scaleFactor, -scaleFactor * centerZ,
            0, 0, 0, 1
        ];
    }
    normalizeVertices(originalVertices:number[][])
    {
        // Find the bounding box of the mesh
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        for (let i=0;i< originalVertices.length; i++) {
            let vertex=originalVertices[i];
            minX = Math.min(minX, vertex[0]);
            minY = Math.min(minY, vertex[1]);
            minZ = Math.min(minZ, vertex[2]);
            maxX = Math.max(maxX, vertex[0]);
            maxY = Math.max(maxY, vertex[1]);
            maxZ = Math.max(maxZ, vertex[2]);
        }

        // Calculate the center of the bounding box
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        // Calculate the largest dimension of the bounding box
        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;
        const maxDimension = Math.max(width, height, depth);

        // Calculate the scale factor to normalize the largest dimension to a specific value
        const targetMaxDimension = 2;  // Set the desired normalized size
        const scaleFactor = targetMaxDimension / maxDimension;

        // Apply the normalization matrix to each vertex
        const normalizedVertices = originalVertices.map(vertex => {
            const [x, y, z] = vertex;
            const transformedX = scaleFactor * (x - centerX);
            const transformedY = scaleFactor * (y - centerY);
            const transformedZ = scaleFactor * (z - centerZ);
            return [transformedX, transformedY, transformedZ];
        });

        return normalizedVertices;
    }
    // compile and link shader int oa shader program
    // there is a vertex shader and a fragment shader.
    // Vertex shader applied model view transform 
    // Fragment shader implements a light model based on the object properties.
    buildShaders() : boolean {
        // Define the vertex and fragment shaders
        const vertexShaderSource = `
            attribute vec4 aPosition;
            attribute vec3 aNormal;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vNormal;
            varying vec4 Position;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
                Position= gl_Position;
                vec3 n= normalize(aNormal);
                vNormal = mat3(uModelViewMatrix) * n;        
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec3 vNormal;
            varying vec4 Position;
            //material
            uniform vec3 uMatAmbientColor; 
            uniform vec3 uMatSpecularColor; 
            uniform vec3 uMatDiffuseColor; 
            uniform float uMatShininess; 
            uniform float uMatTransparency;

            //light       
            uniform vec4 uPointLight;         
            uniform vec3 uLigthAmbientColor; 
            uniform vec3 uLigthSpecularColor; 
            uniform vec3 uLigthDiffuseColor;    
            void main(void) {
                //transparency                      
                float alpha=uMatTransparency; //1 fully opaque, 0 : transparent

                // Ambient
                vec3 ambient = uLigthAmbientColor * uMatAmbientColor;
            
                // Diffuse
                vec3 norm = normalize(vNormal);
                vec3 lightDir = normalize(uPointLight - Position).xyz;
                float diff = max(dot(norm, lightDir), 0.0);
                vec3 diffuse = uLigthDiffuseColor * (diff * uMatDiffuseColor);
            
                // Specular
                vec3 viewDir = normalize(-Position).xyz;
                vec3 reflectDir = reflect(-lightDir, norm);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), uMatShininess);
                vec3 specular = uLigthSpecularColor * (spec * uMatSpecularColor);
            
                vec3 result = ambient + diffuse + specular;
                gl_FragColor = vec4(result, alpha);
            }
        `;
        // Compile shaders
        let error:boolean = true;
        function compileShader(gl:WebGLRenderingContext, source:any, type:any) : WebGLProgram
        {
            error=true;
            const shader = gl.createShader(type) as WebGLShader;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error("[viewer.ts] An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return shader;
            }
            error=false;
            return shader;
        }
        error = true;
        let vertexShader = compileShader(this.gl, vertexShaderSource, this.gl.VERTEX_SHADER) as WebGLShader;
        let error_v=error;
        error = true;
        let fragmentShader = compileShader(this.gl, fragmentShaderSource, this.gl.FRAGMENT_SHADER) as WebGLShader;
        let error_f=error;
        if(error_v || error_f ) 
        {
            if(error_v)console.error("[viewer.ts] Unable to initialize compile vertex shader program:");
            if(error_f)console.error("[viewer.ts] Unable to initialize compile fragment shader program:");

            return false;
        }

        // Create a shader program
        this.shaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.shaderProgram, vertexShader);
        this.gl.attachShader(this.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.shaderProgram);

        if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
            console.error("[viewer.ts] Unable to initialize the shader program:", this.gl.getProgramInfoLog(this.shaderProgram));
            return false;
        }

        this.gl.useProgram(this.shaderProgram);
        return true;

    }
    //apply rotation transform and combine in modelViewMatrix
    setModelViewMatrix(x_deg:number, y_deg:number,z_deg:number, t:vec3)
    {
        // Set up the model-view matrix
        mat4.identity(this.modelViewMatrix);
        mat4.translate(this.modelViewMatrix, this.modelViewMatrix, t);
        mat4.rotateZ(this.modelViewMatrix, this.modelViewMatrix, -3.14*z_deg/180.0);        
        mat4.rotateY(this.modelViewMatrix, this.modelViewMatrix, -3.14*y_deg/180.0);        
        mat4.rotateX(this.modelViewMatrix, this.modelViewMatrix, 3.14*x_deg/180.0);     
    }
    // Generate a new set of indices to be displayed line by line
    generateLineIndices(indices: number[]): number[] {

        const lines: Set<string> = new Set();

        // Function to make it easier to add lines into the set
        const addLine = (i1: number, i2: number) => {
            const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
            if (!lines.has(key)) {
                lines.add(key);
            }
        };

        // Rearranging the vertice indexes for stroke rendering
        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i];
            const i2 = indices[i + 1];
            const i3 = indices[i + 2];
            addLine(i1, i2);
            addLine(i2, i3);
            addLine(i3, i1);
        }

        // Converts the set into an array
        const lineIndices: number[] = [];
        lines.forEach(line => {
            const [i1, i2] = line.split('-').map(Number);
            lineIndices.push(i1, i2);
        });

        return lineIndices;
    }
    
    initVBO(vertices:number[],indices:number[],normals:number[]):boolean
    {
        this.indices = indices;

        // initialize shader attributes
        this.locations.attrib.aPosition = this.gl.getAttribLocation(this.shaderProgram, "aPosition");
        this.locations.attrib.aNormal = this.gl.getAttribLocation(this.shaderProgram, "aNormal");

        if (this.locations.attrib.aPosition === -1 || this.locations.attrib.aNormal === -1) {
            console.error("Failed to get the attribute location.");
            return false;
        }

        // Generate line indices for wireframe rendering
        this.lineIndices = this.generateLineIndices(this.indices);

        // Give the indices to the buffer to be 
        this.buffers.indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);

        // Create and bind the index buffer for wireframe
        this.buffers.lineIndexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.lineIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.lineIndices), this.gl.STATIC_DRAW);

        // Create and bind the position buffer for wireframe
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.vertexAttribPointer(this.locations.attrib.aPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.locations.attrib.aPosition);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);

        // Create and bind the index buffer for faces
        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.vertexAttribPointer(this.locations.attrib.aNormal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.locations.attrib.aNormal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);
        
        return true;
    }
    // create array buffer and vertex buffer array to inject vertices, faces and normals
    // create a perspective transform and save in projectionMatrix
    // condition shader program was built (see buildShaders() and init() )
    initgl(vertices:number[],indices:number[],normals:number[]):boolean
    {
        this.valid= this.initVBO(vertices,indices,normals)
        if(!this.valid)
        {
            console.error("[viewer.ts] Unable to initialize VBO");
            return false;
        }

        // Set up the projection matrix
        const fieldOfView = Math.PI / 4.;
        const aspect = this.canvas.width / this.canvas.height;
        const zNear = 0.1;
        const zFar = 100.0;
        mat4.perspective(this.projectionMatrix, fieldOfView, aspect, zNear, zFar);

        // Set up the model-view matrix
        this.setModelViewMatrix(this.rotations.x,this.rotations.y,this.rotations.z,[-0.0, 0.0, this.tz]);

        // Set uniforms
        this.locations.uniform.uProjectionMatrix = this.gl.getUniformLocation(this.shaderProgram, "uProjectionMatrix");
        this.locations.uniform.uModelViewMatrix = this.gl.getUniformLocation(this.shaderProgram, "uModelViewMatrix");
        //Material
        this.locations.uniform.uMatDiffuseColor = this.gl.getUniformLocation(this.shaderProgram, "uMatDiffuseColor");
        this.locations.uniform.uMatAmbientColor = this.gl.getUniformLocation(this.shaderProgram, "uMatAmbientColor");
        this.locations.uniform.uMatSpecularColor = this.gl.getUniformLocation(this.shaderProgram, "uMatSpecularColor");
        this.locations.uniform.uMatShininess = this.gl.getUniformLocation(this.shaderProgram, "uMatShininess");
        this.locations.uniform.uMatTransparency = this.gl.getUniformLocation(this.shaderProgram, "uMatTransparency");
        //Light
        this.locations.uniform.uPointLight = this.gl.getUniformLocation(this.shaderProgram, "uPointLight");
        this.locations.uniform.uLigthDiffuseColor = this.gl.getUniformLocation(this.shaderProgram, "uLigthDiffuseColor");
        this.locations.uniform.uLigthAmbientColor = this.gl.getUniformLocation(this.shaderProgram, "uLigthAmbientColor");
        this.locations.uniform.uLigthSpecularColor = this.gl.getUniformLocation(this.shaderProgram, "uLigthSpecularColor");        

        this.gl.uniformMatrix4fv(this.locations.uniform.uProjectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.locations.uniform.uModelViewMatrix, false, this.modelViewMatrix);
        // Material
        this.gl.uniform3fv(this.locations.uniform.uMatDiffuseColor, this.object.diffuseColor);
        this.gl.uniform3fv(this.locations.uniform.uMatAmbientColor, this.object.ambientColor);
        this.gl.uniform3fv(this.locations.uniform.uMatSpecularColor, this.object.specularColor);
        this.gl.uniform1f(this.locations.uniform.uMatShininess, this.object.shininess);
        this.gl.uniform1f(this.locations.uniform.uMatTransparency, this.alpha);
        // Ligth
        this.gl.uniform4fv(this.locations.uniform.uPointLight, this.lights.position);
        this.gl.uniform3fv(this.locations.uniform.uLigthDiffuseColor, this.lights.diffuseColor);
        this.gl.uniform3fv(this.locations.uniform.uLigthAmbientColor, this.lights.ambientColor);
        this.gl.uniform3fv(this.locations.uniform.uLigthSpecularColor, this.lights.specularColor);
        return true;
        
    }
    display()
    {
        if(!this.valid) return;
         
        // Clear the canvas
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // Allow dynamic zoom and rotations
        this.setModelViewMatrix(this.rotations.x,this.rotations.y,this.rotations.z,[-0.0, 0.0, this.tz]);

        /// Alpha settings
        // Enabling blending of the computed fragment color values
        this.gl.enable(this.gl.BLEND);
        // Enabling depth comparisons and updates to the depth buffer
        this.gl.enable(this.gl.DEPTH_TEST);
        // Enabling the writing into the depth buffer
        this.gl.depthMask(true);
        // Defines which function is used for blending pixel arithmetic
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        /// Set uniforms
        // Make the alpha dynamic into the fragment shader
        this.gl.uniform1f(this.locations.uniform.uMatTransparency, this.alpha);
        // Allows to move and scale the mesh through the vertex shader
        this.gl.uniformMatrix4fv(this.locations.uniform.uProjectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.locations.uniform.uModelViewMatrix, false, this.modelViewMatrix);
        
        if(this.displayFaces)
        {
            // Bind the indices for vertices
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
            this.gl.drawElements(this.gl.TRIANGLES, this.indices.length, this.gl.UNSIGNED_SHORT, 0);
        }
        else {
            // Bind the indices for lines
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.lineIndexBuffer);
            this.gl.drawElements(this.gl.LINES, this.lineIndices.length, this.gl.UNSIGNED_SHORT, 0);
        }

        this.gl.disable(this.gl.BLEND);
        
    }
    // set or reset data to bind to a VBO
    init(mesh:MeshData, alpha : number)
    {
        if (!mesh) {
            alert('Unable to read mesh data. Your project may be corrupted');
            return;
        }      
        //init transparency
        this.alpha=(1.0*alpha)/100.0;
        // console.log("alpha=",this.alpha)
        this.projectionMatrix = mat4.create();
        this.modelViewMatrix = mat4.create();           
        // Define the cube's vertices 
        const normalized_vertices= this.normalizeVertices(mesh.vertices) as number[][];
        const vertices = this.flatten_array(normalized_vertices) as number[];
        const normals = this.flatten_array(mesh.normals) as number[];

        // Define the indices to create triangles
        this.indices = this.flatten_array(mesh.faces) as number[];

        if(this.buildShaders())
        {
            this.valid=this.initgl(vertices,this.indices,normals)
            if(!this.valid)
            {
                return;
            }            
            this.display();
        }
    }
    reset(alpha : number)
    {
        //reset transparency
        this.alpha=(1.0*alpha)/100.0;
        // console.log("alpha=",this.alpha)

        this.display();
    }
    zoom(deltaZoom : number)
    {
        this.tz += deltaZoom;
        // console.log("tz=",this.tz)
        this.display();
    }
    rotate(offsetX : number, offsetY : number) 
    {
        const rotationSpeed = 1;

        // Convert mouse offsets to rotation angles
        this.rotations.y += (offsetX * rotationSpeed) % 360;
        this.rotations.x += (offsetY * rotationSpeed) % 360;

        this.display();
    }
}
