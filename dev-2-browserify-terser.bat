
for /F %%i in ('npm root -g') do ( set globalModulePath=%%i)

set browserifyPath="browserify.cmd"
set bundleCollapserPath="%globalModulePath%/bundle-collapser/plugin"
set terserPath="terser.cmd"

set module=callq

if not exist ./debug md debug

call %browserifyPath% -p %bundleCollapserPath% -o ./debug/bundle.release.js -v ^
	-t [ %globalModulePath%/stringify --extensions [.html .css .htm ] --minify true ] ^
	-r ./%module%.js:%module%

echo on

call %terserPath% ./debug/bundle.release.js -o ./debug/bundle.release.js -c -m

pause
