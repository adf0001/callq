
chcp 936

set watchifyPath="C:\Users\Administrator\AppData\Roaming\npm\watchify.cmd"

set module=callq

if not exist ./release md release

%watchifyPath% -o ./release/bundle.js -v ^
	-r ./%module%.js:%module% ^


pause
