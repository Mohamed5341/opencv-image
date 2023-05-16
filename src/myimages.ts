import * as vscode from 'vscode';
import * as Jimp from 'jimp';


enum ImagesTypes {
    NONE = -1,
    CV_8U = 0,
    CV_8S = 1,
    CV_16U = 2,
    CV_16S = 3,
    CV_32S = 4,
    CV_32F = 5,
    CV_64F = 6,
    CV_16F = 7,
    CV_8UC1 = 0,
    CV_8UC2 = 8,
    CV_8UC3 = 16,
    CV_8UC4 = 24,
    CV_8SC1 = 1,
    CV_8SC2 = 9,
    CV_8SC3 = 17,
    CV_8SC4 = 25,
    CV_16UC1 = 2,
    CV_16UC2 = 10,
    CV_16UC3 = 18,
    CV_16UC4 = 26,
    CV_16SC1 = 3,
    CV_16SC2 = 11,
    CV_16SC3 = 19,
    CV_16SC4 = 27,
    CV_32SC1 = 4,
    CV_32SC2 = 12,
    CV_32SC3 = 20,
    CV_32SC4 = 28,
    CV_32FC1 = 5,
    CV_32FC2 = 13,
    CV_32FC3 = 21,
    CV_32FC4 = 29,
    CV_64FC1 = 6,
    CV_64FC2 = 14,
    CV_64FC3 = 22,
    CV_64FC4 = 30,
    CV_16FC1 = 7,
    CV_16FC2 = 15,
    CV_16FC3 = 23,
    CV_16FC4 = 31,
}

export class MyImagesHandler{
    savingLocation: vscode.Uri;
    imagesList: MyImage[] = [];

    constructor(path: vscode.Uri){
        this.savingLocation = path;
    }

    async addImage(varName: string, varRef: number, showMat: boolean){
        const session = vscode.debug.activeDebugSession;
        if(session){
            const response = await session.customRequest('variables', {variablesReference: varRef});
            const currentImg = new MyImage(response, this.savingLocation, varName, varRef);

            if(currentImg.valid){
                const loc = this.checkImageExists(currentImg);
    
                if(loc === -1){
                    this.imagesList.push(currentImg);
                }else{
                    this.imagesList[loc] = currentImg;
                }
    
                await currentImg.readImageFromMemory(showMat);
            }else{
                vscode.window.showWarningMessage("Please Initialize variable.");
            }

        }
    }

    async deleteAllImages(){
        for(var i = 0; i < this.imagesList.length; i++){
            this.imagesList[i].deleteImage();
        }
    }

    private checkImageExists(img: MyImage): number{
        var location: number = -1;
        for(var i = 0; i < this.imagesList.length; i++){
            if(this.imagesList[i].variableName === img.variableName){
                location = i;
            }
        }

        return location;
    }
    
}

class MyImage{
    type: ImagesTypes = ImagesTypes.NONE;
    flags: number = 0;
    dims: number = 0;
    cols: number = 0;
    rows: number = 0;
    startAddress: string = "";
    endAddress: string = "";
    imagePath!: vscode.Uri;
    imageSaved: boolean = false;
    variableName: string = "";
    valid: boolean = false;
    numberOfChannels: number = 0;


    constructor(response: any, folderPath: vscode.Uri, varname: string, varRef: number){
        if("variables" in response){
            const varVal = response.variables;

            varVal.forEach(async (element: any) => {
                const name = element.name;
                switch (name) {
                    case 'flags':
                        this.flags = parseInt(element.value);
                        break;
                    case 'dims':
                        this.dims = parseInt(element.value);
                        break;
                    case 'rows':
                        this.rows = parseInt(element.value);
                        break;
                    case 'cols':
                        this.cols = parseInt(element.value);
                        break;
                    case 'datastart':
                        this.startAddress = this.getHexFromString(element.value);
                        break;
                    case 'dataend':
                        this.endAddress = this.getHexFromString(element.value);
                        break;
                    default:
                        break;
                }
            });

            this.imagePath = vscode.Uri.joinPath(folderPath, varname + "_" + varRef + ".jpg");

            this.variableName = varname + "_" + varRef;

            this.type = this.flags&0xFFF;
            if(this.dims !== 0 && this.cols !== 0 && this.rows !== 0){
                this.valid = true;

                const numberOfBytes: number = parseInt(this.endAddress) - parseInt(this.startAddress);
                this.numberOfChannels = numberOfBytes/(this.cols*this.rows);
                return;
            }
            
        }
    }



    async readImageFromMemory(viewMat: boolean){
        const session = vscode.debug.activeDebugSession;
        let imgBuffer: any;

        if(session){
            const numberOfBytes: number = parseInt(this.endAddress) - parseInt(this.startAddress);
            const response = await session.customRequest('readMemory', {memoryReference: this.startAddress, offset: 0, count: numberOfBytes});
            if(this.numberOfChannels === 3){
                imgBuffer = Buffer.from(response.data, 'base64');
            }else if(this.numberOfChannels === 1){
                imgBuffer = this.getImageFromGrayscale(response.data);
            }

            if(imgBuffer){
                for(var i = 0; i < imgBuffer.length; i+=3 ){
                    let temp = imgBuffer[i];
                    imgBuffer[i] = imgBuffer[i+2];
                    imgBuffer[i+2] = temp;
                }

                await new Jimp({data: imgBuffer, width: this.cols, height: this.rows}, (error: any, image: any) => {    
                    if(error){
                        vscode.window.showErrorMessage("Error parsing image from buffer");
                    }else{
                        image.write(this.imagePath.fsPath);
                        this.imageSaved = true;
                        if(viewMat){
                            const panel = vscode.window.createWebviewPanel("imageMat", this.variableName, vscode.ViewColumn.Two);
                            panel.webview.html = this.getHtml(panel.webview.asWebviewUri(this.imagePath), imgBuffer);
                        }else{
                            this.showImage();
                        }
                    }
                });
            }else{
                vscode.window.showErrorMessage("Error Handling image");
            }
        }
    }

    private getImageFromGrayscale(grayBuffer: string): Buffer{
        const grayBuff = Buffer.from(grayBuffer, 'base64');
        var result = Buffer.alloc(grayBuff.length*3);;
        
        for(var i = 0; i < grayBuff.length; i++ ){
            result[3*i] = grayBuff[i];
            result[3*i+1] = grayBuff[i];
            result[3*i+2] = grayBuff[i];
        }

        return result;
    }

    private getHtml(imgUri: vscode.Uri, dataBuffer: any): string{
        let tablesString = "";
        let channels = [];
        if(this.numberOfChannels === 1){
            channels.push("grayscale");
        }else if(this.numberOfChannels === 3){
            channels.push("red");
            channels.push("green");
            channels.push("blue");
        }
        
        //tablesString += "<h2> channel # </h2>".replace("#", channels[k]);
        tablesString += "<table>";
        tablesString += "<thead><tr><th>#</th>";
        for(var i1 = 0; i1 < this.cols; i1++){
            tablesString += "<th>" + i1 + "</th>";
        }
        tablesString += "</tr></thead><tbody>";
        for(var j = 0; j < this.rows; j++){
            tablesString += '<tr><th>' + j + '</th>';
            for(var i = 0; i < this.cols; i++){
                //tablesString += dataBuffer.toString;
                switch(this.numberOfChannels){
                    case 3:
                        tablesString += "<td>(" + dataBuffer[this.numberOfChannels*(j*this.cols + i) + 2] + 
                                "," + dataBuffer[this.numberOfChannels*(j*this.cols + i) + 1] + 
                                "," + dataBuffer[this.numberOfChannels*(j*this.cols + i)] + ")</td>";
                        break;
                    case 1:
                        tablesString += "<td>" + dataBuffer[this.numberOfChannels*(j*this.cols + i)] + "</td>";
                        break;
                }
            }
            tablesString += "</tr>";
        }

        tablesString += "</tbody></table>";
        //vscode.debug.activeDebugConsole.appendLine();
    
        let result = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Display image matrix</title>
            <style>
                table {
                    font-size: 125%;
                    white-space: nowrap;
                    margin: 0;
                    border: none;
                    border-collapse: separate;
                    border-spacing: 0;
                    table-layout: fixed;
                    border: 1px solid black;
                }
                table td,
                table th {
                    border: 1px solid black;
                    padding: 0.5rem 1rem;
                }
                table thead th {
                    padding: 3px;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    width: 25vw;
                    background: white;
                }
                table td {
                    background: #fff;
                    padding: 4px 5px;
                    text-align: center;
                }
                
                table tbody th {
                    font-weight: 100;
                    font-style: italic;
                    text-align: left;
                    position: relative;
                }
                table thead th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 2;
                }
                table tbody th {
                    position: sticky;
                    left: 0;
                    background: white;
                    z-index: 1;
                }
            </style>
        </head>
        <body>
            <h1>Image</h1>
            <img src="${imgUri}" width="300" />
            <h1>Image Matrix</h1>
            <p style="font-size:160%;">Image is ${this.rows}x${this.cols}x${this.numberOfChannels}</p>
            ${tablesString}
        </body>
        </html>`;

        return result;
    }


    private decodeImage(responseBuffer: string): Buffer{
        let inputBuffer = Buffer.from(responseBuffer, 'base64');
        let result = Buffer.alloc(1);

        return result;
    }

    private getHexFromString(str: string): string{
        let result = "";
        const hexChars = "0123456789ABCDEFabcdef";

        if(str.charAt(0) === '0' && str.charAt(1).toLowerCase() === 'x'){
            result = "0x";
            for(var i = 2; i < str.length; i++){
                if(hexChars.includes(str.charAt(i))){
                    result += str.charAt(i);
                }else{
                    break;
                }
            }
        }else{
            result = "0x00";
        }

        return result;
    }

    showImage(){
        vscode.commands.executeCommand('vscode.open', this.imagePath, {viewColumn: vscode.ViewColumn.Two, preview: false});
    }

    deleteImage(){
        vscode.workspace.fs.delete(this.imagePath);
    }
}

