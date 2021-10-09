
set watchifyPath="watchify.cmd"

set module=callq

title watchify - %module%

if not exist ./release md release

for /F %%i in ('npm root -g') do ( set globalModulePath=%%i)

%watchifyPath% -o ./release/bundle.js -v ^
	-t [ "%globalModulePath%/stringify" --extensions [.html .css .htm ] ] ^
	-r ./%module%.js:%module%

