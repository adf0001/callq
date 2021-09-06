
chcp 936

set browserifyPath="browserify.cmd"
set bundleCollapserPath="%USERPROFILE%\AppData\Roaming\npm\node_modules\bundle-collapser\plugin"
set terserPath="terser.cmd"

set module=callq

if not exist ./release md release

call %browserifyPath% -p %bundleCollapserPath% -o ./release/bundle.min.js -v ^
	-r ./%module%.js:%module%

echo on

call %terserPath% ./release/bundle.min.js -o ./release/bundle.min.js -c -m

pause
