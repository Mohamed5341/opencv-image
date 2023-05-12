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
        vscode.debug.activeDebugConsole.appendLine("Folder path is: " + path.fsPath);
    }

    async addImage(varName: string, varRef: number){
        const session = vscode.debug.activeDebugSession;
        if(session){
            vscode.debug.activeDebugConsole.appendLine("current debug session is: name = " + session.name + " type " + session.type);
            const response = await session.customRequest('variables', {variablesReference: varRef});
            vscode.debug.activeDebugConsole.appendLine("Requested Variable is: " + response);
            const currentImg = new MyImage(response, this.savingLocation, varName, varRef);

            if(currentImg.valid){
                vscode.debug.activeDebugConsole.appendLine("Current Image is valid");
                const loc = this.checkImageExists(currentImg);
    
                if(loc === -1){
                    vscode.debug.activeDebugConsole.appendLine("Selected image is not saved.");
                    this.imagesList.push(currentImg);
                }else{
                    vscode.debug.activeDebugConsole.appendLine("Selected image is already saved.");
                    this.imagesList[loc] = currentImg;
                }
    
                vscode.debug.activeDebugConsole.appendLine("Reading image from memory.");
                await currentImg.readImageFromMemory();
                vscode.debug.activeDebugConsole.appendLine("Start Showing Image.");
                currentImg.showImage();
            }else{
                vscode.debug.activeDebugConsole.appendLine("Current image is not valid");
                vscode.window.showWarningMessage("Please Initialize variable.");
            }

        }
    }

    async deleteAllImages(){
        for(var i = 0; i < this.imagesList.length; i++){
            vscode.debug.activeDebugConsole.appendLine("Deleting image: " + this.imagesList[i].imagePath.fsPath);
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
                vscode.debug.activeDebugConsole.appendLine("Current Attribute: " + element.name + " = " + element.value);
            });

            this.imagePath = vscode.Uri.joinPath(folderPath, varname + "_" + varRef + ".jpg");
            vscode.debug.activeDebugConsole.appendLine("image path: " + this.imagePath.fsPath);

            this.variableName = varname;

            this.type = this.flags&0xFFF;
            if(this.dims !== 0 && this.cols !== 0 && this.rows !== 0){
                vscode.debug.activeDebugConsole.appendLine("Image dimentions are not valid.");
                this.valid = true;
                return;
            }
            
        }
    }



    async readImageFromMemory(){
        const session = vscode.debug.activeDebugSession;
        let imgBuffer;

        if(session){
            const numberOfBytes: number = parseInt(this.endAddress) - parseInt(this.startAddress);
            const numberOfChannels: number = numberOfBytes/(this.cols*this.rows);
            vscode.debug.activeDebugConsole.appendLine("Image data size is: " + numberOfBytes + " byte");
            vscode.debug.activeDebugConsole.appendLine("Image channels are: " + numberOfChannels + " channel");
            try{
                vscode.debug.activeDebugConsole.appendLine("Reading memory starts at: " + this.startAddress + " with " + numberOfBytes + " byte");
                const response = await session.customRequest('readMemory', {memoryReference: this.startAddress, offset: 0, count: numberOfBytes});
                if(numberOfChannels === 3){
                    imgBuffer = Buffer.from(response.data, 'base64');
                }else if(numberOfChannels === 1){
                    imgBuffer = this.getImageFromGrayscale(response.data);
                }
    
                if(imgBuffer){
                    for(var i = 0; i < imgBuffer.length; i+=3 ){
                        let temp = imgBuffer[i];
                        imgBuffer[i] = imgBuffer[i+2];
                        imgBuffer[i+2] = temp;
                    }
    
                    await new Jimp({data: imgBuffer, width: this.cols, height: this.rows}, (error, image) => {
                        if(error){
                            vscode.debug.activeDebugConsole.appendLine("Error happens in creating image from buffer: " + error);
                        }else{
                            vscode.debug.activeDebugConsole.appendLine("Saving image to: " + this.imagePath.fsPath);
                            image.write(this.imagePath.fsPath);
                            this.imageSaved = true;
                        }
                    });
                }else{
                    vscode.window.showErrorMessage("Error Handling image");
                }
            }catch(e: any){
                vscode.debug.activeDebugConsole.appendLine("Error wile reading memory: " + e);
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

